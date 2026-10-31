import {
	NodeConnectionTypes,
	type IDataObject,
	type IHookFunctions,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';
import { RAMP_CREDENTIAL_NAME } from '../Ramp/shared/constants';
import { rampApiRequest } from '../Ramp/shared/transport';
import { WEBHOOK_EVENT_TYPES } from './events';
import { verifyRampSignature } from './signature';

const ALL_EVENTS = '*';

const VERIFICATION_EVENT = 'webhooks.verification';

type WebhookSubscription = {
	id: string;
	endpoint_url: string;
	event_types?: string[] | null;
	status?: 'active' | 'inactive' | 'pending_verification';
	secret?: string;
};

/** Ramp needs an explicit list, so "All Events" expands to every event type this node knows. */
function selectedEventTypes(selected: unknown): string[] {
	const events = Array.isArray(selected)
		? selected.filter((event): event is string => typeof event === 'string')
		: [];
	const expanded = events.includes(ALL_EVENTS)
		? WEBHOOK_EVENT_TYPES.map((option) => String(option.value))
		: events;
	return [...new Set(expanded)].sort();
}

function sameEventTypes(a: string[] | null | undefined, b: string[]): boolean {
	const left = [...(a ?? [])].sort();
	return left.length === b.length && left.every((value, index) => value === b[index]);
}

async function findSubscriptionsByUrl(
	this: IHookFunctions | IWebhookFunctions,
	url: string,
): Promise<WebhookSubscription[]> {
	const subscriptions: WebhookSubscription[] = await rampApiRequest.call(this, 'GET', '/webhooks');
	return (Array.isArray(subscriptions) ? subscriptions : []).filter(
		(subscription) => subscription.endpoint_url === url,
	);
}

export class RampTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Ramp Trigger',
		name: 'rampTrigger',
		icon: { light: 'file:../../icons/ramp.svg', dark: 'file:../../icons/ramp.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].includes("*") ? "All events" : $parameter["events"].join(", ")}}',
		description: 'Starts the workflow when something happens in Ramp',
		defaults: {
			name: 'Ramp Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: RAMP_CREDENTIAL_NAME,
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: [
					{
						name: 'All Events',
						value: ALL_EVENTS,
						description: 'Every event type this node lists',
					},
					...WEBHOOK_EVENT_TYPES,
				],
				default: [],
				required: true,
				description:
					'Which Ramp events start the workflow. The credential needs the read scope of each resource, such as transactions:read for transaction events.',
			},
			{
				displayName:
					'Ramp events only carry the ID of the record that changed. Add a Ramp node after this trigger, for example Transaction > Get with the record ID from the object field of the event, to load the full record. Ramp may send an event more than once and out of order. The event ID stays the same on every retry, so use it to skip duplicates.',
				name: 'payloadNotice',
				type: 'notice',
				default: '',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				if (!webhookUrl) return false;
				const webhookData = this.getWorkflowStaticData('node');
				const eventTypes = selectedEventTypes(this.getNodeParameter('events'));

				const existing = await findSubscriptionsByUrl.call(this, webhookUrl);
				let keep: WebhookSubscription | undefined;
				for (const subscription of existing) {
					// Ramp only returns a subscription's secret when it is created, so a
					// subscription this node did not create cannot be verified. Ramp has no
					// update endpoint either, so a changed event list also means a new one.
					const reusable =
						keep === undefined &&
						subscription.id === webhookData.webhookId &&
						typeof webhookData.webhookSecret === 'string' &&
						subscription.status !== 'inactive' &&
						sameEventTypes(subscription.event_types, eventTypes);
					if (reusable) {
						keep = subscription;
					} else {
						await rampApiRequest.call(this, 'DELETE', `/webhooks/${subscription.id}`);
					}
				}
				return keep !== undefined;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const webhookData = this.getWorkflowStaticData('node');
				const eventTypes = selectedEventTypes(this.getNodeParameter('events'));

				// Ramp answers with the secret once, then posts a verification challenge to
				// the URL, which `webhook()` below passes back to activate the subscription.
				const response: WebhookSubscription = await rampApiRequest.call(
					this,
					'POST',
					'/webhooks',
					{},
					{ endpoint_url: webhookUrl, event_types: eventTypes },
				);

				if (!response.id || typeof response.secret !== 'string') return false;
				webhookData.webhookId = response.id;
				webhookData.webhookSecret = response.secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (typeof webhookData.webhookId !== 'string') return true;

				try {
					await rampApiRequest.call(this, 'DELETE', `/webhooks/${webhookData.webhookId}`);
				} catch (error) {
					this.logger.warn(`Could not delete Ramp webhook subscription ${webhookData.webhookId}`, {
						error: error instanceof Error ? error.message : String(error),
					});
					return false;
				}

				delete webhookData.webhookId;
				delete webhookData.webhookSecret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body: IDataObject = this.getBodyData();

		if (body.type === VERIFICATION_EVENT && typeof body.challenge === 'string') {
			// Acknowledge first, then confirm the challenge with Ramp. The lookup goes by
			// URL rather than stored state, because Ramp can send the challenge before
			// activation has saved the subscription ID. A forged challenge only fails
			// Ramp's own check. No workflow runs, so a manual test keeps listening.
			this.getResponseObject().status(200).json({ challenge: body.challenge }).end();
			const webhookUrl = this.getNodeWebhookUrl('default');
			try {
				const pending = webhookUrl ? await findSubscriptionsByUrl.call(this, webhookUrl) : [];
				for (const subscription of pending.filter((entry) => entry.status === 'pending_verification')) {
					await rampApiRequest.call(this, 'POST', `/webhooks/${subscription.id}/verify`, {}, {
						challenge: body.challenge,
					});
				}
			} catch (error) {
				this.logger.warn('Could not verify the Ramp webhook subscription', {
					error: error instanceof Error ? error.message : String(error),
				});
			}
			return { noWebhookResponse: true };
		}

		const secret = this.getWorkflowStaticData('node').webhookSecret;
		const isValid =
			typeof secret === 'string' &&
			verifyRampSignature({
				secret,
				rawBody: this.getRequestObject().rawBody ?? '',
				signatureHeader: this.getHeaderData()['x-ramp-signature'],
			});

		if (!isValid) {
			this.getResponseObject().status(401).send('Invalid signature').end();
			return { noWebhookResponse: true };
		}

		return {
			workflowData: [this.helpers.returnJsonArray(body)],
		};
	}
}

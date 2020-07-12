import { Resolvable } from './mqtt.types';
import {
    ConnectResponsePacket,
    PingResponsePacket,
    PublishAckPacket,
    PublishCompletePacket,
    PublishReceivedPacket,
    PublishReleasePacket,
    PublishRequestPacket,
    SubscribeResponsePacket,
    UnsubscribeResponsePacket,
} from './packets';

export function matchTopic(baseTopic: string, incomingTopic: string): boolean {
    if (baseTopic.length === incomingTopic.length && baseTopic === incomingTopic) return true;
    const parts = baseTopic.split('+');
    let remaining = incomingTopic;
    for (const part of parts) {
        if (!remaining.startsWith(part)) {
            return false;
        }
        remaining = removeUntil(remaining.substring(part.length), '/');
    }
    return true;
}

export function expectRemainingLength(length: number, expected?: number): void {
    if(!expected) {
        expected = 0;
    }
    if(length !== expected) {
        throw new Error(`Expected remaining length to be ${expected} but got ${length}`);
    }
}

export function removeUntil(input: string, char: string): string {
    return input.substring(Math.max(input.indexOf(char), 0));
}

export function extractParams(template: string, topic: string): Record<string, string> {
    const templateParts = template.split('/');
    const topicParts = topic.split('/');
    const params: Record<string, string> = {};
    for (let i = 0; i < Math.min(templateParts.length, topicParts.length); i++) {
        if (templateParts[i].startsWith(':')) {
            params[templateParts[i].substring(1)] = topicParts[i];
        }
    }
    return params;
}

export interface Resolvers<T> {
    resolve: (value: T) => void;
    reject: (error: Error) => void;
}

export const nullOrUndefined = (input: unknown) => input == undefined;

export const isConnAck = (target: unknown): target is ConnectResponsePacket => target instanceof ConnectResponsePacket;
export const isPublish = (target: unknown): target is PublishRequestPacket => target instanceof PublishRequestPacket;
export const isPubAck = (target: unknown): target is PublishAckPacket => target instanceof PublishAckPacket;
export const isPubRec = (target: unknown): target is PublishReceivedPacket => target instanceof PublishReceivedPacket;
export const isPubRel = (target: unknown): target is PublishReleasePacket => target instanceof PublishReleasePacket;
export const isPubComp = (target: unknown): target is PublishCompletePacket => target instanceof PublishCompletePacket;
export const isSubAck = (target: unknown): target is SubscribeResponsePacket =>
    target instanceof SubscribeResponsePacket;
export const isUnsubAck = (target: unknown): target is UnsubscribeResponsePacket =>
    target instanceof UnsubscribeResponsePacket;
export const isPingResp = (target: unknown): target is PingResponsePacket => target instanceof PingResponsePacket;

export async function resolve<T extends Record<string, unknown>>(resolvable: Resolvable<T>): Promise<T> {
    return typeof resolvable === 'object' ? resolvable : await resolvable();
}

export function notUndefined<T>(value: T | undefined): value is T {
    return typeof value !== 'undefined';
}

export function toBuffer(value: Buffer | string): Buffer {
    return typeof value === 'string' ? Buffer.from(value) : value;
}

const paramRegex = /\/:[A-Za-z-_0-9]+/g;
export function toMqttTopicFilter(paramString: string): [string, string?] {
    if (paramString.match(paramRegex)) {
        return [paramString.replace(paramRegex, '/+'), paramString];
    }
    return [paramString];
}

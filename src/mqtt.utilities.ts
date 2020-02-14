import { ListenerInfo } from './mqtt.types';
import { MqttMessage } from './mqtt.message';

export function topicListener<T>(options: {
    topic: string;
    transformer: (data: MqttMessage) => T | PromiseLike<T>;
    validator?: (data: MqttMessage) => boolean | PromiseLike<boolean>;
    onData: (data: T) => void | PromiseLike<void>;
}): ListenerInfo<MqttMessage, T> {
    return {
        eventName: 'message',
        validator: data => {
            if (data.topic === options.topic) {
                return options.validator ? options.validator(data) : true;
            }
            return false;
        },
        transformer: options.transformer,
        onData: options.onData,
    };
}

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

export function removeUntil(input: string, char: string): string {
    return input.substring(Math.max(input.indexOf(char), 0));
}

export function extractParams(template: string, topic: string): object {
    const templateParts = template.split('/');
    const topicParts = topic.split('/');
    const params: any = {};
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

export const nullOrUndefined = (input: any) => input == undefined;

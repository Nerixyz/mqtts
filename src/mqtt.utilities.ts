import { ListenerInfo } from './mqtt.types';
import { MqttMessage } from './mqtt.message';
import { MqttPacket } from './mqtt.packet';
import {
    ConnectRequestPacket,
    ConnectResponsePacket,
    DisconnectRequestPacket,
    PingRequestPacket,
    PingResponsePacket,
    PublishAckPacket,
    PublishCompletePacket,
    PublishReceivedPacket,
    PublishReleasePacket,
    PublishRequestPacket,
    SubscribeRequestPacket,
    SubscribeResponsePacket,
    UnsubscribeRequestPacket,
    UnsubscribeResponsePacket,
} from './packets';
import { PacketTypes } from './mqtt.constants';

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

export function isPacket(target: any, type: number): boolean {
    return target.packetType === type;
}

export const isConnect = (target: MqttPacket): target is ConnectRequestPacket =>
    isPacket(target, PacketTypes.TYPE_CONNECT);
export const isConnAck = (target: MqttPacket): target is ConnectResponsePacket =>
    isPacket(target, PacketTypes.TYPE_CONNACK);
export const isPublish = (target: MqttPacket): target is PublishRequestPacket =>
    isPacket(target, PacketTypes.TYPE_PUBLISH);
export const isPubAck = (target: MqttPacket): target is PublishAckPacket => isPacket(target, PacketTypes.TYPE_PUBACK);
export const isPubRec = (target: MqttPacket): target is PublishReceivedPacket =>
    isPacket(target, PacketTypes.TYPE_PUBREC);
export const isPubRel = (target: MqttPacket): target is PublishReleasePacket =>
    isPacket(target, PacketTypes.TYPE_PUBREL);
export const isPubComp = (target: MqttPacket): target is PublishCompletePacket =>
    isPacket(target, PacketTypes.TYPE_PUBCOMP);
export const isSubscribe = (target: MqttPacket): target is SubscribeRequestPacket =>
    isPacket(target, PacketTypes.TYPE_SUBSCRIBE);
export const isSubAck = (target: MqttPacket): target is SubscribeResponsePacket =>
    isPacket(target, PacketTypes.TYPE_SUBACK);
export const isUnsubscribe = (target: MqttPacket): target is UnsubscribeRequestPacket =>
    isPacket(target, PacketTypes.TYPE_UNSUBSCRIBE);
export const isUnsubAck = (target: MqttPacket): target is UnsubscribeResponsePacket =>
    isPacket(target, PacketTypes.TYPE_UNSUBACK);
export const isPingReq = (target: MqttPacket): target is PingRequestPacket =>
    isPacket(target, PacketTypes.TYPE_PINGREQ);
export const isPingResp = (target: MqttPacket): target is PingResponsePacket =>
    isPacket(target, PacketTypes.TYPE_PINGRESP);
export const isDisconnect = (target: MqttPacket): target is DisconnectRequestPacket =>
    isPacket(target, PacketTypes.TYPE_DISCONNECT);

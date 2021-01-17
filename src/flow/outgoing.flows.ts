import { ConnectRequestOptions, ConnectResponsePacket, SubscribeResponsePacket, SubscribeReturnCode } from '../packets';
import { MqttMessageOutgoing } from '../mqtt.message';
import { MqttSubscription } from '../mqtt.types';
import { PacketFlowFunc } from './packet-flow';
import { generateIdentifier } from '../mqtt.packet';
import {
    isConnAck,
    isPingResp,
    isPubAck,
    isPubComp,
    isPubRec,
    isSubAck,
    isUnsubAck,
    toBuffer,
} from '../mqtt.utilities';
import { DefaultPacketReadResultMap } from '../packets/packet-reader';
import { DefaultPacketWriteOptions, defaultWrite } from '../packets/packet-writer';
import { PacketType } from '../mqtt.constants';
import { SubscribeError } from '../errors';

export function outgoingConnectFlow(
    options: ConnectRequestOptions,
): PacketFlowFunc<DefaultPacketReadResultMap, DefaultPacketWriteOptions, ConnectResponsePacket> {
    const finalOptions = {
        protocolLevel: 4,
        clientId: 'mqtt_' + Math.round(Math.random() * 10e5),
        clean: true,
        keepAlive: 60,
        protocolName: 'MQTT',
        ...options,
    };
    return (success, error) => ({
        start: () => defaultWrite(PacketType.Connect, finalOptions),
        accept: isConnAck,
        next: (res: ConnectResponsePacket) => (res.isSuccess ? success(res) : error(res.errorName)),
    });
}
export function outgoingDisconnectFlow(): PacketFlowFunc<DefaultPacketReadResultMap, DefaultPacketWriteOptions, void> {
    return success => ({
        start: () => {
            success();
            return defaultWrite(PacketType.Disconnect);
        },
    });
}

export function outgoingPingFlow(): PacketFlowFunc<DefaultPacketReadResultMap, DefaultPacketWriteOptions, void> {
    return success => ({
        start: () => defaultWrite(PacketType.PingReq),
        accept: isPingResp,
        next: () => success(),
    });
}

export function outgoingPublishFlow(
    message: MqttMessageOutgoing,
    _identifier?: number,
): PacketFlowFunc<DefaultPacketReadResultMap, DefaultPacketWriteOptions, MqttMessageOutgoing> {
    const id = _identifier ?? generateIdentifier();
    let receivedPubRec = false;
    return success => ({
        start: () => {
            const packet = defaultWrite(PacketType.Publish, {
                topic: message.topic,
                payload: toBuffer(message.payload),
                qos: message.qosLevel || 0,
                retain: message.retained || false,
                duplicate: message.duplicate || false,
                identifier: message.qosLevel ? id : undefined,
            });

            if (!message.qosLevel) success(message);

            return packet;
        },
        accept: (packet: unknown) => {
            if (message.qosLevel === 1 && isPubAck(packet)) {
                return packet.identifier === id;
            } else if (message.qosLevel === 2) {
                if (isPubRec(packet)) {
                    return packet.identifier === id;
                } else if (receivedPubRec && isPubComp(packet)) {
                    return packet.identifier === id;
                }
            }
            return false;
        },
        next: (packet: unknown) => {
            if (isPubAck(packet) || isPubComp(packet)) {
                success(message);
            } else if (isPubRec(packet)) {
                receivedPubRec = true;
                return defaultWrite(PacketType.PubRel, { identifier: id });
            }
        },
    });
}

export function outgoingSubscribeFlow(
    subscription: MqttSubscription,
    identifier?: number,
): PacketFlowFunc<DefaultPacketReadResultMap, DefaultPacketWriteOptions, SubscribeReturnCode> {
    const id = identifier ?? generateIdentifier();
    return (success, error) => ({
        start: () =>
            defaultWrite(PacketType.Subscribe, {
                identifier: id,
                subscriptions: [{ qos: subscription.qosLevel || 0, topic: subscription.topic }],
            }),
        accept: (packet: unknown) => isSubAck(packet) && packet.identifier === id,
        next: (packet: SubscribeResponsePacket) => {
            if (!packet.anyError) {
                success(packet.returnCodes[0]);
            } else {
                error(
                    new SubscribeError(
                        `Failed to subscribe to ${subscription.topic} - Return Codes: ${packet.returnCodes.join(', ')}`,
                    ),
                );
            }
        },
    });
}

export function outgoingUnsubscribeFlow(
    subscription: MqttSubscription,
    identifier?: number,
): PacketFlowFunc<DefaultPacketReadResultMap, DefaultPacketWriteOptions, void> {
    const id = identifier ?? generateIdentifier();
    return success => ({
        start: () =>
            defaultWrite(PacketType.Unsubscribe, {
                identifier: id,
                topics: [subscription.topic],
            }),
        accept: packet => isUnsubAck(packet) && packet.identifier === id,
        next: () => success(),
    });
}

import {
    ConnectRequestOptions,
    ConnectRequestPacket,
    ConnectResponsePacket,
    DisconnectRequestPacket,
    PingRequestPacket,
    PublishReleasePacket,
    PublishRequestPacket,
    SubscribeRequestPacket,
    SubscribeResponsePacket,
    UnsubscribeRequestPacket,
} from '../packets';
import { defaults, random } from 'lodash';
import { MqttMessageOutgoing } from '../mqtt.message';
import { MqttSubscription } from '../mqtt.types';
import { PacketFlowFunc } from './packet-flow';
import { MqttPacket } from '../mqtt.packet';
import { isConnAck, isPingResp, isPubAck, isPubComp, isPubRec, isSubAck, isUnsubAck } from '../mqtt.utilities';

export function outgoingConnectFlow(options: ConnectRequestOptions): PacketFlowFunc<ConnectRequestOptions> {
    options = defaults(options, {
        protocol: 3,
        clientId: 'mqtt_' + random(1, 100000),
        cleanSession: true,
        keepAlive: 60,
    });
    return (success, error) => ({
        start: () => new ConnectRequestPacket(options),
        accept: isConnAck,
        next: (res: ConnectResponsePacket) => (res.isSuccess ? success(options) : error(res.errorName)),
    });
}
export function outgoingDisconnectFlow(): PacketFlowFunc<void> {
    return success => ({
        start: () => {
            success();
            return new DisconnectRequestPacket();
        },
    });
}

export function outgoingPingFlow(): PacketFlowFunc<void> {
    return success => ({
        start: () => new PingRequestPacket(),
        accept: isPingResp,
        next: () => success(),
    });
}

export function outgoingPublishFlow(
    message: MqttMessageOutgoing,
    _identifier?: number,
): PacketFlowFunc<MqttMessageOutgoing> {
    const id = _identifier ?? MqttPacket.generateIdentifier();
    let receivedPubRec = false;
    return success => ({
        start: () => {
            const packet = new PublishRequestPacket(message.topic, message.payload);
            packet.qosLevel = message.qosLevel || 0;
            packet.duplicate = message.duplicate || false;
            packet.retained = message.retained || false;

            if (!message.qosLevel) success(message);
            else packet.identifier = id;

            return packet;
        },
        accept: (packet: MqttPacket) => {
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
        next: (packet: MqttPacket) => {
            if (isPubAck(packet) || isPubComp(packet)) {
                success(message);
            } else if (isPubRec(packet)) {
                receivedPubRec = true;
                return new PublishReleasePacket(id);
            }
        },
    });
}

export function outgoingSubscribeFlow(
    subscription: MqttSubscription,
    identifier?: number,
): PacketFlowFunc<MqttSubscription> {
    const id = identifier ?? MqttPacket.generateIdentifier();
    return (success, error) => ({
        start: () => {
            const packet = new SubscribeRequestPacket(subscription.topic, subscription.qosLevel || 0);
            packet.identifier = id;
            return packet;
        },
        accept: (packet: MqttPacket) => isSubAck(packet) && packet.identifier === id,
        next: (packet: SubscribeResponsePacket) => {
            if (packet.returnCodes.every(value => !packet.isError(value))) {
                success(subscription);
            } else {
                error(`Failed to subscribe to ${subscription.topic}`);
            }
        },
    });
}

export function outgoingUnsubscribeFlow(subscription: MqttSubscription, identifier?: number): PacketFlowFunc<void> {
    const id = identifier ?? MqttPacket.generateIdentifier();
    return success => ({
        start: () => {
            const packet = new UnsubscribeRequestPacket(subscription.topic);
            packet.identifier = id;
            return packet;
        },
        accept: (packet: MqttPacket) => isUnsubAck(packet) && packet.identifier === id,
        next: () => success(),
    });
}

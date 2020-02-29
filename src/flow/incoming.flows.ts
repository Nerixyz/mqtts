import { PingResponsePacket, PublishAckPacket, PublishCompletePacket, PublishReceivedPacket } from '../packets';
import { MqttMessage } from '../mqtt.message';
import { PacketFlowFunc } from './packet-flow';
import { isPubRel } from '../mqtt.utilities';

export function incomingPingFlow(): PacketFlowFunc<void> {
    return success => ({
        start: () => {
            success();
            return new PingResponsePacket();
        },
    });
}

export function incomingPublishFlow(message: MqttMessage, identifier = -1): PacketFlowFunc<MqttMessage> {
    return success => ({
        start: () => {
            let packet = undefined;
            let emit = true;
            if (message.qosLevel === 1) {
                packet = new PublishAckPacket();
            } else if (message.qosLevel === 2) {
                packet = new PublishReceivedPacket();
                emit = false;
            }
            if (packet) packet.identifier = identifier;
            if (emit) success(message);
            return packet;
        },
        accept: packet => isPubRel(packet) && packet.identifier === identifier,
        next: () => {
            success(message);
            const response = new PublishCompletePacket();
            response.identifier = identifier;
            return response;
        },
    });
}

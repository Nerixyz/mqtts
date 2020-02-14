import {
    PingResponsePacket,
    PublishAckPacket,
    PublishCompletePacket,
    PublishReceivedPacket,
    PublishReleasePacket,
} from '../packets';
import { MqttMessage } from '../mqtt.message';
import { PacketTypes } from '../mqtt.constants';
import { PacketFlowFunc } from './packet-flow';

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
        accept: packet =>
            packet.packetType === PacketTypes.TYPE_PUBREL && (packet as PublishReleasePacket).identifier === identifier,
        next: () => {
            success(message);
            const response = new PublishCompletePacket();
            response.identifier = identifier;
            return response;
        },
    });
}

import { MqttMessage } from '../mqtt.message';
import { PacketFlowFunc } from './packet-flow';
import { isPubRel } from '../mqtt.utilities';
import { DefaultPacketReadResultMap } from '../packets/packet-reader';
import { DefaultPacketWriteOptions, defaultWrite } from '../packets/packet-writer';
import { PacketType } from '../mqtt.constants';

export function incomingPingFlow(): PacketFlowFunc<DefaultPacketReadResultMap, DefaultPacketWriteOptions, void> {
    return success => ({
        start: () => {
            success();
            return defaultWrite(PacketType.PingResp);
        },
    });
}

export function incomingPublishFlow(
    message: MqttMessage,
    identifier: number,
): PacketFlowFunc<DefaultPacketReadResultMap, DefaultPacketWriteOptions, MqttMessage> {
    return success => ({
        start: () => {
            let packet = undefined;
            let emit = true;
            if (message.qosLevel === 1) {
                packet = defaultWrite(PacketType.PubAck, { identifier });
            } else if (message.qosLevel === 2) {
                packet = defaultWrite(PacketType.PubRec, { identifier });
                emit = false;
            }
            if (emit) success(message);
            return packet;
        },
        accept: packet => isPubRel(packet) && packet.identifier === identifier,
        next: () => {
            success(message);
            return defaultWrite(PacketType.PubComp, { identifier });
        },
    });
}

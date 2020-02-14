import { PacketTypes } from '../mqtt.constants';
import { MqttPacket } from '../mqtt.packet';

export class PublishCompletePacket extends MqttPacket {
    get hasIdentifier(): boolean {
        return true;
    }

    public constructor() {
        super(PacketTypes.TYPE_PUBCOMP);
    }
}

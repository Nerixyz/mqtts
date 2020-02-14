import { PacketTypes } from '../mqtt.constants';
import { PacketStream } from '../packet-stream';
import { MqttPacket } from '../mqtt.packet';
import { InvalidDirectionError } from '../errors';

export class SubscribeResponsePacket extends MqttPacket {
    public get returnCodes(): number[] {
        return this._returnCodes;
    }
    public set returnCodes(value: number[]) {
        value.forEach(e => this.assertValidReturnCode(e));
        this._returnCodes = value;
    }

    get hasIdentifier(): boolean {
        return true;
    }

    private static readonly qosLevels = {
        q0: 'Max QoS 0',
        q1: 'Max QoS 1',
        q2: 'Max QoS 2',
        q128: 'Failure',
    };

    private _returnCodes: number[];

    public constructor() {
        super(PacketTypes.TYPE_SUBACK);
    }

    public read(stream: PacketStream): void {
        super.read(stream);

        const returnCodeLen = this.remainingPacketLength - 2;
        this._returnCodes = [];
        for (let i = 0; i < returnCodeLen; i++) {
            const code = stream.readByte();
            this.assertValidReturnCode(code);
            this._returnCodes.push(code);
        }
    }

    public write(): void {
        throw new InvalidDirectionError('write');
    }

    public isError(returnCode: number) {
        return returnCode === 128;
    }

    public getReturnCodeName(returnCode: 0 | 1 | 2 | 128) {
        // @ts-ignore - this is valid
        return SubscribeResponsePacket.qosLevels[`q${returnCode.toString()}`];
    }

    protected assertValidReturnCode(returnCode: number) {
        if (returnCode & 0b0111_1100) {
            throw new Error(`Invalid return code: ${returnCode}`);
        }
    }
}

import { PacketType } from './mqtt.constants';
import { PacketStream } from './packet-stream';
import { EndOfStreamError, MalformedPacketError, UnexpectedPacketError } from './errors';
import { Transform, TransformCallback } from 'stream';
import { Debugger } from 'debug';
import {
    DefaultPacketReadMap,
    DefaultPacketReadResultMap,
    PacketReadMap,
    PacketReadResultMap,
} from './packets/packet-reader';

export interface MqttParseResult<ReadMap extends PacketReadResultMap, T extends PacketType> {
    type: T;
    flags: number;
    data: ReadMap[T];
}

export interface MqttTransformerOptions<T extends PacketReadResultMap = DefaultPacketReadResultMap> {
    debug?: Debugger;
    mapping?: PacketReadMap<T>;
}

export class MqttTransformer<ReadMap extends PacketReadResultMap = DefaultPacketReadResultMap> extends Transform {
    // force the type here
    public mapping: PacketReadMap<ReadMap> = DefaultPacketReadMap as PacketReadMap<ReadMap>;

    private internalStream: PacketStream | undefined = undefined;

    constructor(public options: MqttTransformerOptions<ReadMap> = {}) {
        super({ objectMode: true });
        this.mapping = {
            ...this.mapping,
            ...options.mapping,
        };
    }

    _transform(chunk: Buffer, encoding: string, callback: TransformCallback): void {
        if (!Buffer.isBuffer(chunk)) {
            callback(new Error('Expected a Buffer'));
            return;
        }

        const stream = this.internalStream ? this.internalStream.write(chunk, false) : PacketStream.fromBuffer(chunk);
        this.internalStream = undefined;

        let startPos = 0;
        while (stream.remainingBytes > 0) {
            const firstByte = stream.readByte();
            const type = (firstByte >> 4) as PacketType;
            const flags = (firstByte & 0x0f);

            const packetFn = this.mapping[type];
            if (!packetFn) {
                callback(
                    new UnexpectedPacketError(`No packet found for ${type}; @${stream.position}/${stream.length}`),
                );
                return;
            }
            let remainingLength = -1;
            try {
                remainingLength = stream.readVariableByteInteger();
                const packet = packetFn(stream, remainingLength, flags);
                this.push({
                    type,
                    data: packet,
                    flags
                });
                stream.cut();
                startPos = stream.position;
            } catch (e) {
                if (e instanceof EndOfStreamError) {
                    this.options.debug?.(
                        `EOS:\n  ${remainingLength} got: ${stream.length} (+) ${chunk.byteLength};\n  return: ${startPos};`,
                    );
                    stream.position = startPos;
                    this.internalStream = stream.cut();
                    callback();
                    return;
                } else {
                    callback(
                        new MalformedPacketError(
                            `Error in parser (type: ${type}): 
                        ${e.stack}; 
                        exiting; 
                        resetting;
                        stream: ${stream.data.toString('base64')}`,
                        ),
                    );
                    return;
                }
            }
        }
        callback();
    }

    public reset(): void {
        this.internalStream = undefined;
    }
}

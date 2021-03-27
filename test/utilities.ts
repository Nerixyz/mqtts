import { assert } from 'chai';
import { IllegalStateError, PacketStream, PacketType, PacketWriteResult, Transport } from '../src';
import { DefaultPacketWriteOptions, PacketWriteOptionsMap, PacketWriter } from '../src/packets/packet-writer';
import { Duplex, Readable, Writable } from 'stream';
import duplexify = require('duplexify');

type Class<T> = { new (...args: any[]): T };

export async function assertIteratorValue<T>(
    iterator: AsyncIterableIterator<T>,
    assertValue: (value: T) => boolean | void,
): Promise<void> {
    const next = await iterator.next();
    assert.strictEqual(next.done, false, 'A value is expected from the iterator.');
    const valueAssertion = assertValue(next.value);
    if (typeof valueAssertion !== 'undefined') {
        assert(valueAssertion, 'The value assertion failed.');
    }
}

export function assertTransformerIteratorValueInstanceOf<T>(
    iterator: AsyncIterableIterator<{ type: number; flags: number; data: T }>,
    proto: Class<T>,
): Promise<void> {
    return assertIteratorValue(iterator, value => assert.instanceOf(value.data, proto));
}

export async function assertIteratorDone(iterator: AsyncIterableIterator<unknown>): Promise<void> {
    const next = await iterator.next();
    assert.deepStrictEqual(next, { done: true, value: undefined }, 'The iterator is expected to be done');
}

export function assertPacketStream(stream: PacketStream, ...content: string[]): void {
    assertBuffer(stream.data, ...content);
}

export function assertBuffer(buffer: Buffer, ...content: string[]): void {
    assert.strictEqual(buffer.toString('hex').toLowerCase(), content.join('').toLowerCase());
}

export function assertWritePacket<T>(
    fn: (stream: PacketStream, options: T) => PacketWriteResult,
    options: T,
    expectedResult: PacketWriteResult,
    ...content: string[]
): void {
    const stream = PacketStream.empty();
    assert.deepStrictEqual(fn(stream, options), expectedResult);
    assertPacketStream(stream, ...content);
}

export function assertPacket<T>(packet: T, instance: Class<T>, expected: T): void {
    assert.instanceOf(packet, instance);
    assert.deepStrictEqual(packet, expected);
}

export function ignoreEverything() {}

export async function assertTransportConnectsAndDisconnects(transport: Transport<unknown>) {
    const writer = new PacketWriter({ logPacketWrite: ignoreEverything });

    await transport.connect();
    if(!transport.duplex)
        throw new IllegalStateError('TEST: no duplex');

    assert.strictEqual(
        transport.duplex.push(
            writer.write(PacketType.Connect, {
                protocolLevel: 4,
                protocolName: 'MQTT',
                clean: true,
                keepAlive: 60,
                clientId: '1234',
            }),
        ),
        true,
    );

    const firstPacket = await transport.duplex[Symbol.asyncIterator]().next();
    assert.strictEqual(firstPacket.done, false);
    assert(firstPacket.value);
    await new Promise<void>(resolve => transport.duplex?.end(resolve) ?? resolve());
    transport.duplex.destroy();
    assert.strictEqual(transport.duplex.destroyed, true);
    assert.strictEqual(transport.duplex.push('A'), false);
}

class MockTransport extends Transport<{ initialPackets?: Buffer[] }> {
    // these will be set on the constructor
    written!: Buffer[];
    writable!: Writable;
    duplex!: Duplex;
    nextDataBuffer!: Buffer[];
    nextDataFn?: (data: Buffer) => void;

    constructor(options: { initialPackets?: Buffer[] }) {
        super(options);
        this.reset();
    }

    reset() {
        this.written = [];
        this.writable = new Writable({
            write: (chunk, encoding, callback) => {
                this.written.push(chunk);
                callback();
            },
            objectMode: true,
        });
        this.nextDataBuffer = [];
        this.duplex = duplexify(
            this.writable,
            Readable.from(createMockGenerator(this)(this.options.initialPackets ?? [])),
            { objectMode: true },
        );
    }

    push(data: Buffer) {
        if (this.nextDataFn) this.nextDataFn(data);
        else this.nextDataBuffer.push(data);
    }

    connect(): Promise<void> {
        return Promise.resolve(undefined);
    }
}

function createMockGenerator(transport: MockTransport) {
    return async function* (initial: Buffer[]) {
        for (const data of initial) {
            yield data;
        }
        while (true) {
            if (transport.nextDataBuffer.length) {
                for (const data in transport.nextDataBuffer) {
                    yield data;
                }
                transport.nextDataBuffer = [];
            }
            yield await new Promise(resolve => {
                transport.nextDataFn = resolve;
            });
        }
    };
}

export function createMockTransport(initial: Buffer[] = []) {
    return new MockTransport({ initialPackets: initial });
}

export function createMockPacketWriter<WriteMap extends PacketWriteOptionsMap = DefaultPacketWriteOptions>(
    write: <T extends PacketType>(type: T, options: WriteMap[T]) => Buffer,
) {
    const writer = new PacketWriter({ logPacketWrite: ignoreEverything });
    writer.write = write;
    return writer;
}

export function promisifyEvent<EventName, EventArg>(
    handler: { once(e: EventName, fn: (...args: [EventArg]) => void): any },
    key: EventName,
): Promise<EventArg> {
    // make the compiler happy. The event names aren't cool Saj
    return new Promise<EventArg>(resolve => handler.once(key, resolve as any));
}

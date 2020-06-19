import {
    MalformedPacketError,
    MqttTransformer,
    PingResponsePacket,
    SubscribeResponsePacket,
    UnexpectedPacketError,
} from '../src';
import {  Readable } from 'stream';
import { assertIteratorDone, assertIteratorValueInstanceOf } from './utilities';
import { assert, use } from 'chai';
import chaiAsPromised = require('chai-as-promised');
use(chaiAsPromised);

function* validPingResponse() {
    yield Buffer.from('d000', 'hex');
}

function* incompletePingResponse() {
    yield Buffer.from('d0', 'hex');
}

function* splitPingResponse() {
    yield Buffer.from('d0', 'hex');
    yield Buffer.from('00', 'hex');
}

function* invalidType() {
    yield Buffer.from('f0', 'hex');
}

function* malformedPacket() {
    // 3 isn't a valid return code
    yield Buffer.from('9003000103', 'hex');
}

function* twoPackets() {
    yield Buffer.from('d0009003000100', 'hex');
}

function* twoSplitPackets() {
    yield Buffer.from('d0009003', 'hex');
    yield Buffer.from('000100', 'hex');
}

describe('MqttTransformer', function() {
    it('parses valid packets', async function() {
        const iterator = Readable.from(validPingResponse()).pipe(new MqttTransformer())[Symbol.asyncIterator]();
        await assertIteratorValueInstanceOf(iterator,  PingResponsePacket);
        await assertIteratorDone(iterator);
    });

    it('parses multiple packets in the same chunk', async function() {
        const iterator = Readable.from(twoPackets()).pipe(new MqttTransformer())[Symbol.asyncIterator]();
        await assertIteratorValueInstanceOf(iterator, PingResponsePacket);
        await assertIteratorValueInstanceOf(iterator, SubscribeResponsePacket);
        await assertIteratorDone(iterator);
    });

    it('parses multiple packets in different chunks', async function() {
        const iterator = Readable.from(twoSplitPackets()).pipe(new MqttTransformer())[Symbol.asyncIterator]();
        await assertIteratorValueInstanceOf(iterator, PingResponsePacket);
        await assertIteratorValueInstanceOf(iterator, SubscribeResponsePacket);
        await assertIteratorDone(iterator);
    });

    it('is empty on EOL', async function() {
        const iterator = Readable.from(incompletePingResponse()).pipe(new MqttTransformer())[Symbol.asyncIterator]();
        await assertIteratorDone(iterator);
    });

    it('joins chunks on EOL', async function() {
        const iterator = Readable.from(splitPingResponse()).pipe(new MqttTransformer())[Symbol.asyncIterator]();
        await assertIteratorValueInstanceOf(iterator, PingResponsePacket);
    });

    it('errors on invalid type', async function() {
        const iterator = Readable.from(invalidType()).pipe(new MqttTransformer())[Symbol.asyncIterator]();
        await assert.isRejected(iterator.next(), UnexpectedPacketError);
    });

    it('errors on malformed packet', async function() {
        const iterator = Readable.from(malformedPacket()).pipe(new MqttTransformer())[Symbol.asyncIterator]();
        await assert.isRejected(iterator.next(), MalformedPacketError);
    });
});
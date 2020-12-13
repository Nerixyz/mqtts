import { assert } from 'chai';
import { PacketStream } from './packet-stream';

describe('PacketStream', function() {
    describe('creating', function() {
        it('should create a Buffer of a given length', function() {
            assert.strictEqual(PacketStream.fromLength(10).data.length, 10);
        });
        it('should create a Stream with the data of a Buffer', function() {
            const input = Buffer.alloc(10);
            assert.strictEqual(PacketStream.fromBuffer(input).data, input);
        });
        it('should create a Stream from UTF8 data', function() {
            const input = 'TEST';
            assert.deepStrictEqual(PacketStream.fromString(input).data, Buffer.from(input));
        });
        it('should create a Buffer from hex values', function() {
            const input = '0123456789abcdef';
            assert.deepStrictEqual(PacketStream.fromHex(input).data, Buffer.from(input, 'hex'));
        });
        it('should create an empty stream', function() {
            assert.strictEqual(PacketStream.empty().data.length, 0);
        });
    });
    describe('writing', function() {
        it('should write a Buffer', function() {
            const input = Buffer.from('my string');
            assert.strictEqual(PacketStream.empty().write(input).data.toString(), 'my string');
        });
    });
});
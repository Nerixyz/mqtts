import { assertPacket } from '../../test/utilities';
import { readSubscribeResponsePacket, SubscribeResponsePacket, SubscribeReturnCode } from './subscribe.response.packet';
import { PacketStream } from '../packet-stream';
import { assert } from 'chai';

describe('SubscribeResponsePacket', function () {
    describe('readSubscribeResponsePacket', function () {
        it('should read a minimal packet', function () {
            assertPacket(
                readSubscribeResponsePacket(PacketStream.fromHex('000100'), 3),
                SubscribeResponsePacket,
                new SubscribeResponsePacket(1, [SubscribeReturnCode.MaxQoS0]),
            );
        });
        it('should read multiple return codes', function () {
            assertPacket(
                readSubscribeResponsePacket(PacketStream.fromHex('000100010280'), 6),
                SubscribeResponsePacket,
                new SubscribeResponsePacket(1, [
                    SubscribeReturnCode.MaxQoS0,
                    SubscribeReturnCode.MaxQoS1,
                    SubscribeReturnCode.MaxQoS2,
                    SubscribeReturnCode.Fail,
                ]),
            );
        });
        it('should throw if one return code is not 0/1/2/0x80', function() {
            assert.throws(() => readSubscribeResponsePacket(PacketStream.fromHex('0001020103'), 5));
        });
    });
    describe('model', function() {
        describe('#anyError', function() {
            it('should return true if the return codes contain Fail', function() {
                assert.strictEqual(new SubscribeResponsePacket(1, [
                    SubscribeReturnCode.MaxQoS2, SubscribeReturnCode.MaxQoS1,SubscribeReturnCode.Fail]).anyError, true);
            });
            it('should return false if there is no Fail', function() {
                assert.strictEqual(new SubscribeResponsePacket(1, [
                    SubscribeReturnCode.MaxQoS2, SubscribeReturnCode.MaxQoS1,SubscribeReturnCode.MaxQoS0]).anyError, false);
            });
        });
    });
});

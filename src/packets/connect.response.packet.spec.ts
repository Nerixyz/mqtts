import { ConnectResponsePacket, ConnectReturnCode, readConnectResponsePacket } from './connect.response.packet';
import { PacketStream } from '../packet-stream';
import { assertPacket } from '../../test/utilities';
import { assert } from 'chai';

describe('ConnectResponsePacket', function () {
    describe('readConnectResponsePacket', function() {
        it('should read a basic packet', function () {
            assertPacket(
                readConnectResponsePacket(PacketStream.fromBuffer(Buffer.from('0100', 'hex')), 2),
                ConnectResponsePacket,
                new ConnectResponsePacket(1, ConnectReturnCode.Accepted),
            );
        });
        it('should throw on invalid length', function () {
            assert.throws(() => readConnectResponsePacket(PacketStream.fromBuffer(Buffer.from('01', 'hex')), 1));
        });
        it('should throw on invalid ack', function () {
            assert.throws(() => readConnectResponsePacket(PacketStream.fromBuffer(Buffer.from('0200', 'hex')), 2));
        });
        it('should throw on invalid return code', function () {
            assert.throws(() => readConnectResponsePacket(PacketStream.fromBuffer(Buffer.from('0106', 'hex')), 2));
        });
    });
    describe('mock', function() {
        describe('#sessionPresent', function() {
            it('should return true if the acknowledge flags = 1', function() {
                assert.strictEqual(new ConnectResponsePacket(1, ConnectReturnCode.Accepted).sessionPresent, true);
            });
            it('should return false if the acknowledge flags = 0', function() {
                assert.strictEqual(new ConnectResponsePacket(0, ConnectReturnCode.Accepted).sessionPresent, false);
            });
        });

        describe('#isSuccess', function() {
            it('should return true if the return code is 0', function() {
               assert.strictEqual(new ConnectResponsePacket(0, ConnectReturnCode.Accepted).isSuccess, true);
            });
            it('should return false if the code is != 0', function() {
                assert.strictEqual(new ConnectResponsePacket(0, ConnectReturnCode.UnacceptableProtocolVersion).isSuccess, false)
            });
        });

        describe('#errorName', function() {
            it('should return a proper error name for the code 0', function() {
                assert.strictEqual(new ConnectResponsePacket(0, ConnectReturnCode.Accepted).errorName,
                    'Accepted');
            });
            it('should return a proper error name for the code 1', function() {
                assert.strictEqual(new ConnectResponsePacket(0, ConnectReturnCode.UnacceptableProtocolVersion).errorName,
                    'UnacceptableProtocolVersion');
            });
            it('should return a proper error name for the code 2', function() {
                assert.strictEqual(new ConnectResponsePacket(0, ConnectReturnCode.IdentifierRejected).errorName,
                    'IdentifierRejected');
            });
            it('should return a proper error name for the code 3', function() {
                assert.strictEqual(new ConnectResponsePacket(0, ConnectReturnCode.ServerUnavailable).errorName,
                    'ServerUnavailable');
            });
            it('should return a proper error name for the code 4', function() {
                assert.strictEqual(new ConnectResponsePacket(0, ConnectReturnCode.BadUsernameOrPassword).errorName,
                    'BadUsernameOrPassword');
            });
            it('should return a proper error name for the code 5', function() {
                assert.strictEqual(new ConnectResponsePacket(0, ConnectReturnCode.NotAuthorized).errorName,
                    'NotAuthorized');
            });
        });
    });
});

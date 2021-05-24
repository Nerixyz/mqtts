import { MqttMessage } from '../mqtt.message';
import { incomingPublishFlow, incomingPingFlow } from './incoming.flows';
import { ignoreEverything } from '../../test/utilities';
import { assert } from 'chai';
import { PacketType } from '../mqtt.constants';
import { PublishReleasePacket } from '../packets';
import sinon = require('sinon');

describe('incomingPublishFlow', function () {
    describe('QoS 0', function () {
        it('should succeed immediately', function () {
            const fake = sinon.fake();
            const message: MqttMessage = {
                topic: 'A',
                payload: Buffer.alloc(0),
                qosLevel: 0,
            };
            incomingPublishFlow(message, -1)(fake, ignoreEverything).start();
            assert.strictEqual(fake.calledOnceWithExactly(message), true);
        });
    });
    describe('QoS 1', function () {
        it('should send a PubAck packet', function () {
            const fake = sinon.fake();
            const message: MqttMessage = {
                topic: 'A',
                payload: Buffer.alloc(0),
                qosLevel: 1,
            };
            const flow = incomingPublishFlow(message, 1)(fake, ignoreEverything);
            const next = flow.start();
            assert.deepStrictEqual(next, {
                type: PacketType.PubAck,
                options: { identifier: 1 },
            });
            assert.strictEqual(fake.calledOnceWithExactly(message), true);
        });
    });
    describe('QoS 2', function () {
        it('should send PubRec wait for PubRel and send PubComp', function () {
            const fake = sinon.fake();
            const message: MqttMessage = {
                topic: 'A',
                payload: Buffer.alloc(0),
                qosLevel: 2,
            };
            const flow = incomingPublishFlow(message, 1)(fake, ignoreEverything);
            const first = flow.start();
            assert.deepStrictEqual(first, {
                type: PacketType.PubRec,
                options: { identifier: 1 },
            });
            assert.strictEqual(fake.callCount, 0);
            const incoming = new PublishReleasePacket(1);
            assert.strictEqual(flow.accept?.(incoming), true);
            assert.strictEqual(fake.callCount, 0);
            assert.deepStrictEqual(flow.next?.(incoming), {
                type: PacketType.PubComp,
                options: { identifier: 1 },
            });
            assert.strictEqual(fake.calledOnceWithExactly(message), true);
        });
    });
});

describe('incomingPingFlow', function () {
    it('should send a PingResp packet', function () {
        const fake = sinon.fake();
        assert.deepStrictEqual(incomingPingFlow()(fake, ignoreEverything).start(), {
            type: PacketType.PingResp,
            options: undefined,
        });
        assert.strictEqual(fake.callCount, 1);
    });
});

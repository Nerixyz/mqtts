import { ignoreEverything } from '../../test/utilities';
import {
    outgoingConnectFlow,
    outgoingDisconnectFlow,
    outgoingPingFlow,
    outgoingPublishFlow,
    outgoingSubscribeFlow,
    outgoingUnsubscribeFlow,
} from './outgoing.flows';
import {
    ConnectResponsePacket,
    ConnectReturnCode,
    PingResponsePacket,
    PublishAckPacket,
    PublishCompletePacket,
    PublishReceivedPacket,
    RequiredConnectRequestOptions,
    SubscribeResponsePacket,
    SubscribeReturnCode,
    UnsubscribeResponsePacket,
} from '../packets';
import { assert } from 'chai';
import { PacketType } from '../mqtt.constants';
import { Buffer } from 'buffer';
import sinon = require('sinon');

describe('outgoingConnectFlow', function () {
    it('should send a connect packet', function () {
        const fake = sinon.fake();
        const options: RequiredConnectRequestOptions = {
            protocolName: 'MQTT',
            protocolLevel: 4,
            clientId: 'me',
            keepAlive: 60,
            clean: true,
        };
        const packet = outgoingConnectFlow(options)(fake, ignoreEverything).start();
        assert.deepStrictEqual(packet, {
            type: PacketType.Connect,
            options,
        });
        assert.strictEqual(fake.callCount, 0);
    });
    it('should succeed on a connect packet with a return code = 0', function () {
        const fake = sinon.fake();
        const flow = outgoingConnectFlow({})(fake, ignoreEverything);
        flow.start();
        const incoming = new ConnectResponsePacket(0, ConnectReturnCode.Accepted);
        assert.strictEqual(fake.callCount, 0);
        assert.deepStrictEqual(flow.accept?.(incoming), true);
        assert.strictEqual(fake.callCount, 0);
        assert.deepStrictEqual(flow.next?.(incoming), undefined);
        assert.deepStrictEqual(fake.calledOnceWithExactly(incoming), true);
    });
    it('should error on a connect packet with return code != 0', function () {
        const fake = sinon.fake();
        const flow = outgoingConnectFlow({})(ignoreEverything, fake);
        flow.start();
        const incoming = new ConnectResponsePacket(0, ConnectReturnCode.IdentifierRejected);
        assert.strictEqual(fake.callCount, 0);
        assert.deepStrictEqual(flow.accept?.(incoming), true);
        assert.strictEqual(fake.callCount, 0);
        assert.deepStrictEqual(flow.next?.(incoming), undefined);
        assert.deepStrictEqual(fake.calledOnce, true);
    });
});

describe('outgoingDisconnectFlow', function () {
    it('should send a Disconnect packet', function () {
        const fake = sinon.fake();
        assert.deepStrictEqual(outgoingDisconnectFlow()(fake, ignoreEverything).start(), {
            type: PacketType.Disconnect,
            options: undefined,
        });
        assert.strictEqual(fake.callCount, 1);
    });
});

describe('outgoingPingFlow', function () {
    it('should send a PingReq packet', function () {
        const fake = sinon.fake();
        assert.deepStrictEqual(outgoingPingFlow()(fake, ignoreEverything).start(), {
            type: PacketType.PingReq,
            options: undefined,
        });
        assert.strictEqual(fake.callCount, 0);
    });
    it('should succeed on PingResp', function () {
        const fake = sinon.fake();
        const flow = outgoingPingFlow()(fake, ignoreEverything);
        assert.deepStrictEqual(flow.start(), {
            type: PacketType.PingReq,
            options: undefined,
        });
        assert.strictEqual(fake.callCount, 0);
        const incoming = new PingResponsePacket();
        assert.strictEqual(flow.accept?.(incoming), true);
        assert.strictEqual(fake.callCount, 0);
        assert.strictEqual(flow.next?.(incoming), undefined);
        assert.strictEqual(fake.calledOnce, true);
    });
});

describe('outgoingPublishFlow', function () {
    it('should support QoS 0', function () {
        const fake = sinon.fake();
        const options = { topic: 'A', payload: Buffer.alloc(0) };
        assert.deepStrictEqual(outgoingPublishFlow(options)(fake, ignoreEverything).start(), {
            type: PacketType.Publish,
            options: {
                duplicate: false,
                qos: 0,
                identifier: undefined,
                retain: false,
                ...options,
            },
        });
        assert.strictEqual(fake.calledOnceWithExactly(options), true);
    });
    it('should support QoS 1', function () {
        const fake = sinon.fake();
        const options = { topic: 'A', payload: Buffer.alloc(0), qosLevel: 1 };
        const flow = outgoingPublishFlow(options, 1)(fake, ignoreEverything);
        assert.deepStrictEqual(flow.start(), {
            type: PacketType.Publish,
            options: {
                duplicate: false,
                identifier: 1,
                retain: false,
                topic: options.topic,
                payload: options.payload,
                qos: 1,
            },
        });
        assert.strictEqual(fake.callCount, 0);
        const incoming = new PublishAckPacket(1);
        assert.strictEqual(flow.accept?.(incoming), true);
        assert.strictEqual(fake.callCount, 0);
        assert.strictEqual(flow.next?.(incoming), undefined);
        assert.strictEqual(fake.calledOnceWithExactly(options), true);
    });
    it('should support QoS 2', function () {
        const fake = sinon.fake();
        const options = { topic: 'A', payload: Buffer.alloc(0), qosLevel: 2 };
        const flow = outgoingPublishFlow(options, 1)(fake, ignoreEverything);
        assert.deepStrictEqual(flow.start(), {
            type: PacketType.Publish,
            options: {
                duplicate: false,
                identifier: 1,
                retain: false,
                topic: options.topic,
                payload: options.payload,
                qos: 2,
            },
        });
        assert.strictEqual(fake.callCount, 0);
        const incoming = new PublishReceivedPacket(1);
        assert.strictEqual(flow.accept?.(incoming), true);
        assert.strictEqual(fake.callCount, 0);
        assert.deepStrictEqual(flow.next?.(incoming), {
            type: PacketType.PubRel,
            options: { identifier: 1 },
        });
        const lastIncoming = new PublishCompletePacket(1);
        assert.strictEqual(flow.accept?.(lastIncoming), true);
        assert.strictEqual(fake.callCount, 0);
        assert.strictEqual(flow.next?.(lastIncoming), undefined);
        assert.strictEqual(fake.calledOnceWithExactly(options), true);
    });
    it('should ignore invalid packets on QoS 1', function () {
        const fake = sinon.fake();
        const options = { topic: 'A', payload: Buffer.alloc(0), qosLevel: 1 };
        const flow = outgoingPublishFlow(options, 1)(fake, ignoreEverything);
        assert.strictEqual(fake.callCount, 0);
        assert.strictEqual(flow.accept?.(new PublishReceivedPacket(1)), false);
        assert.strictEqual(fake.callCount, 0);
        assert.strictEqual(flow.accept?.(new PublishCompletePacket(1)), false);
        assert.strictEqual(fake.callCount, 0);
    });
    it('should ignore invalid packets on QoS 2', function () {
        const fake = sinon.fake();
        const options = { topic: 'A', payload: Buffer.alloc(0), qosLevel: 2 };
        const flow = outgoingPublishFlow(options, 1)(fake, ignoreEverything);
        assert.strictEqual(flow.accept?.(new PublishAckPacket(1)), false);
        assert.strictEqual(fake.callCount, 0);
        const incoming = new PublishReceivedPacket(1);
        flow.next?.(incoming);
        assert.strictEqual(flow.accept?.(incoming), true);
        assert.strictEqual(fake.callCount, 0);
        assert.strictEqual(flow.accept?.(new PublishAckPacket(1)), false);
        assert.strictEqual(fake.callCount, 0);
    });
});

describe('outgoingSubscribeFlow', function () {
    it('should send a Subscribe packet', function () {
        const fake = sinon.fake();
        const options = { topic: 'A' };
        assert.deepStrictEqual(outgoingSubscribeFlow(options, 1)(fake, ignoreEverything).start(), {
            type: PacketType.Subscribe,
            options: { subscriptions: [{ topic: 'A', qos: 0 }], identifier: 1 },
        });
        assert.strictEqual(fake.callCount, 0);
    });
    it('should respect the qos value', function () {
        const options = { topic: 'A', qosLevel: 1 };
        assert.deepStrictEqual(outgoingSubscribeFlow(options, 1)(ignoreEverything, ignoreEverything).start(), {
            type: PacketType.Subscribe,
            options: { subscriptions: [{ topic: 'A', qos: 1 }], identifier: 1 },
        });
    });
    it('should succeed if there is no error', function () {
        const fake = sinon.fake();
        const options = { topic: 'A' };
        const flow = outgoingSubscribeFlow(options, 1)(fake, ignoreEverything);
        flow.start();
        assert.strictEqual(fake.callCount, 0);
        const incoming = new SubscribeResponsePacket(1, [SubscribeReturnCode.MaxQoS0]);
        assert.strictEqual(flow.accept?.(incoming), true);
        assert.strictEqual(fake.callCount, 0);
        assert.strictEqual(flow.next?.(incoming), undefined);
        assert.strictEqual(fake.calledOnceWithExactly(SubscribeReturnCode.MaxQoS0), true);
    });
    it('should error if there is one', function () {
        const fake = sinon.fake();
        const options = { topic: 'A' };
        const flow = outgoingSubscribeFlow(options, 1)(ignoreEverything, fake);
        flow.start();
        assert.strictEqual(fake.callCount, 0);
        const incoming = new SubscribeResponsePacket(1, [SubscribeReturnCode.Fail]);
        assert.strictEqual(flow.accept?.(incoming), true);
        assert.strictEqual(fake.callCount, 0);
        assert.strictEqual(flow.next?.(incoming), undefined);
        assert.strictEqual(fake.calledOnce, true);
    });
});

describe('outgoingUnsubscribeFlow', function () {
    it('should send an Unsubscribe packet', function () {
        const options = { topic: 'A' };
        assert.deepStrictEqual(outgoingUnsubscribeFlow(options, 1)(ignoreEverything, ignoreEverything).start(), {
            type: PacketType.Unsubscribe,
            options: { topics: ['A'], identifier: 1 },
        });
    });
    it('should succeed on UnsubAck', function () {
        const fake = sinon.fake();
        const options = { topic: 'A' };
        const flow = outgoingUnsubscribeFlow(options, 1)(fake, ignoreEverything);
        flow.start();
        assert.strictEqual(fake.callCount, 0);
        const incoming = new UnsubscribeResponsePacket(1);
        assert.strictEqual(flow.accept?.(incoming), true);
        assert.strictEqual(fake.callCount, 0);
        assert.strictEqual(flow.next?.(incoming), undefined);
        assert.strictEqual(fake.calledOnce, true);
    });
});

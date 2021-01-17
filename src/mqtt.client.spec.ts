import { MqttClient } from './mqtt.client';
import { createMockPacketWriter, createMockTransport, ignoreEverything, promisifyEvent } from '../test/utilities';
import sinon = require('sinon');
import { assert, use } from 'chai';
import { RegisterClientOptions } from './mqtt.types';
import { PacketType } from './mqtt.constants';
import { RequiredConnectRequestOptions } from './packets';
import { FlowStoppedError } from './errors';
// eslint-disable-next-line @typescript-eslint/no-var-requires
use(require('chai-as-promised'));

describe('MqttClient', function () {
    it('should connect', async function () {
        const fake = sinon.fake();
        const client = new MqttClient({
            transport: createMockTransport([Buffer.from('20020100', 'hex')]),
            packetWriter: createMockPacketWriter(fake),
        });
        const options: RegisterClientOptions = {
            clientId: 'MQTTS',
        };
        await client.connect(options);
        assert.isTrue(client.ready);
        assert.strictEqual(fake.callCount, 1);
        assert.strictEqual(fake.args[0][0], PacketType.Connect);
        assert.deepStrictEqual(fake.args[0][1] as RequiredConnectRequestOptions, {
            ...options,
            keepAlive: 60,
            clean: true,
            protocolName: 'MQTT',
            protocolLevel: 4,
        });
        await client.disconnect(true);
    });
    it('should wire the transport', async function () {
        const transport = createMockTransport([Buffer.from('20020100', 'hex')]);
        const message = Buffer.alloc(0);
        const client = new MqttClient({
            transport,
            packetWriter: createMockPacketWriter(() => message),
        });
        await client.connect();
        assert.deepStrictEqual(transport.written, [message]);
        await client.disconnect(true);
    });
    it('should attempt to connect after 2000ms', async function () {
        const timer = sinon.useFakeTimers();
        const fake = sinon.fake();
        const client = new MqttClient({
            transport: createMockTransport(),
            packetWriter: createMockPacketWriter(fake),
        });
        const connectPromise = client.connect({
            connectDelay: 2000,
        });
        await timer.tickAsync(1);
        assert.strictEqual(fake.callCount, 1);
        assert.strictEqual(fake.args[0][0], PacketType.Connect);
        await timer.tickAsync(2000);
        assert.strictEqual(fake.callCount, 2);
        assert.deepStrictEqual(fake.args[0], fake.args[1]);
        await client.disconnect(true);
        await connectPromise.catch(ignoreEverything);
    });
    it('should send keep alive packets', async function () {
        const fake = sinon.fake();
        const timer = sinon.useFakeTimers();
        const transport = createMockTransport([Buffer.from('20020100', 'hex')]);
        const client = new MqttClient({
            transport,
            packetWriter: createMockPacketWriter(fake),
        });
        await client.connect({
            keepAlive: 60,
        });
        await timer.tickAsync(60000);
        transport.push(Buffer.from('c000', 'hex'));
        assert.strictEqual(fake.callCount, 2);
        assert.strictEqual(fake.lastCall.args[0], PacketType.PingReq);
        await client.disconnect(true);
    });
    it('should emit the message event on a publish', async function () {
        const transport = createMockTransport([Buffer.from('20020100', 'hex'), Buffer.from('300400014142', 'hex')]);
        const client = new MqttClient({
            transport,
            packetWriter: createMockPacketWriter(() => Buffer.alloc(0)),
        });
        await client.connect({
            keepAlive: 60,
        });
        assert.deepStrictEqual(await promisifyEvent(client, 'message'), {
            topic: 'A',
            payload: Buffer.from('B'),
            qosLevel: 0,
            retained: false,
            duplicate: false,
        });
        await client.disconnect(true);
    });
    describe('reconnecting', function () {
        it('should reconnect', async function () {
            const fake = sinon.fake();
            const transport = createMockTransport([Buffer.from('20020100', 'hex')]);
            const client = new MqttClient({
                transport,
                packetWriter: createMockPacketWriter(fake),
                autoReconnect: true,
            });
            await client.connect();
            assert.strictEqual(fake.callCount, 1);
            assert.strictEqual(fake.args[0][0], PacketType.Connect);
            transport.duplex.destroy();
            await promisifyEvent(client, 'connect');
            assert.strictEqual(fake.callCount, 2);
            assert.strictEqual(fake.args[1][0], PacketType.Connect);
            await client.disconnect(true);
        });
        it('should respect maxReconnectAttempts and reconnectUnready', async function () {
            const fake = sinon.fake();
            const transport = createMockTransport([Buffer.from('20020100', 'hex')]);
            const client = new MqttClient({
                transport,
                packetWriter: createMockPacketWriter(fake),
                autoReconnect: {
                    maxReconnectAttempts: 2,
                    reconnectUnready: true,
                },
            });
            await client.connect();
            assert.strictEqual(fake.callCount, 1);
            transport.duplex.destroy();
            await promisifyEvent(client, 'connect');
            assert.strictEqual(fake.callCount, 2);
            transport.duplex.destroy();
            await promisifyEvent(client, 'connect');
            assert.strictEqual(fake.callCount, 3);
            transport.duplex.destroy();
            await promisifyEvent(client, 'disconnect');
            assert.isTrue(client.disconnected);
        });
    });
    describe('#stopFlow', function () {
        it('should stop the correct flow', async function () {
            const transport = createMockTransport([Buffer.from('20020100', 'hex')]);
            const client = new MqttClient({
                transport,
            });
            const flow = client.startFlow(() => ({
                accept: () => undefined,
                next: () => undefined,
                start: () => undefined,
            }));
            assert.isTrue(client.stopFlow(flow.flowId));
            await assert.isRejected(flow, FlowStoppedError);
        });
    });

    describe('listeners', function () {
        it('should retain the listeners on reconnects', async function () {
            const transport = createMockTransport([
                Buffer.from('20020100', 'hex'),
                Buffer.from('30050003616263', 'hex'),
            ]);
            const client = new MqttClient({
                transport,
                autoReconnect: true,
            });

            let resolveListener: undefined | (() => void) = undefined;
            let listener = new Promise(r => (resolveListener = r));
            const fake = sinon.fake(() => resolveListener?.());

            client.listen('abc', fake);

            await client.connect();
            await listener;

            assert.isTrue(fake.calledOnce);
            assert.strictEqual(fake.args[0][0].topic, 'abc');

            resolveListener = undefined;
            listener = new Promise(r => (resolveListener = r));
            transport.duplex.destroy();
            await promisifyEvent(client, 'connect');
            await listener;

            assert.isTrue(fake.calledTwice);
            assert.strictEqual(fake.args[1][0].topic, 'abc');

            await client.disconnect(true);
        });
    });

    it('should emit events for the packets', async function () {
        const transport = createMockTransport([Buffer.from('20020100', 'hex'), Buffer.from('30050003616263', 'hex')]);
        const client = new MqttClient({
            transport,
            autoReconnect: true,
        });

        await Promise.all([client.connect(), promisifyEvent(client, 'CONNACK')]);
        await promisifyEvent(client, 'PUBLISH');

        await client.disconnect(true);
    });
});

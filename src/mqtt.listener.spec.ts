import { MqttListener } from './mqtt.listener';
import sinon = require('sinon');
import { MqttMessage } from './mqtt.message';
import { assert } from 'chai';
import { ignoreEverything } from '../test/utilities';

describe('MqttListener', function() {
    it('should handles messages correctly', async function() {
        const listener = new MqttListener();
        const fake = sinon.fake();
        listener.addHandler({
            topicFilter: 'garden/lights/1/state',
            handle: fake,
        });
        const message: MqttMessage = {
            topic: 'garden/lights/1/state',
            payload: Buffer.alloc(0),
        };
        await listener.handleMessage(message);
        assert.isTrue(fake.calledOnce);
        assert.deepStrictEqual(fake.lastCall.lastArg, {
            ...message, params: {},
        });
        await listener.handleMessage({payload: Buffer.alloc(0), topic: 'garden/lights/2/state'});
        assert.isTrue(fake.calledOnce);
    });
    it('should add params to the message', async function() {
        const listener = new MqttListener();
        const fake = sinon.fake();
        listener.addHandler({
            topicFilter: 'garden/lights/+/state',
            paramMatcher: 'garden/lights/:lightId/state',
            handle: fake,
        });
        const message1: MqttMessage = {
            topic: 'garden/lights/1/state',
            payload: Buffer.alloc(0),
        };
        await listener.handleMessage(message1);
        assert.isTrue(fake.calledOnce);
        assert.deepStrictEqual(fake.lastCall.lastArg, {
            ...message1, params: {lightId: '1'},
        });
        const message2: MqttMessage = {
            topic: 'garden/lights/2/state',
            payload: Buffer.alloc(0),
        };
        await listener.handleMessage(message2);
        assert.isTrue(fake.calledTwice);
        assert.deepStrictEqual(fake.lastCall.lastArg, {
            ...message2, params: {lightId: '2'},
        })
    });
    it('should invoke the validator', async function() {
        const listener = new MqttListener();
        const fake = sinon.fake();
        listener.addHandler({
            topicFilter: 'garden/lights/+/state',
            paramMatcher: 'garden/lights/:lightId/state',
            handle: ignoreEverything,
            validator: fake,
        });
        const message: MqttMessage = {
            topic: 'garden/lights/1/state',
            payload: Buffer.alloc(0),
        };
        await listener.handleMessage(message);
        assert.isTrue(fake.calledOnce);
        assert.deepStrictEqual(fake.lastCall.args, [{
            ...message,
        }, { lightId: '1' }] );
    });
    it('should invoke the transformer', async function() {
        const listener = new MqttListener();
        const fake = sinon.fake(() => 'transformed');
        const fakeHandler = sinon.fake();
        listener.addHandler({
            topicFilter: 'garden/lights/+/state',
            paramMatcher: 'garden/lights/:lightId/state',
            handle: fakeHandler,
            transformer: fake,
        });
        const message: MqttMessage = {
            topic: 'garden/lights/1/state',
            payload: Buffer.alloc(0),
        };
        await listener.handleMessage(message);
        assert.isTrue(fake.calledOnce);
        assert.deepStrictEqual(fake.lastCall.lastArg, {
            ...message, params: { lightId: '1' }
        });
        assert.isTrue(fakeHandler.calledOnceWithExactly('transformed'));
    });
    it('should transform promises', async function() {
        const listener = new MqttListener();
        const fakeHandler = sinon.fake();
        listener.addHandler({
            topicFilter: 'garden/lights/+/state',
            paramMatcher: 'garden/lights/:lightId/state',
            handle: fakeHandler,
            transformer: async () => 'transformed',
        });
        await listener.handleMessage({
            topic: 'garden/lights/1/state',
            payload: Buffer.alloc(0),
        });
        assert.isTrue(fakeHandler.calledOnceWithExactly('transformed'));
    });
    it('should remove a listener once the function is invoked', async function() {
        const listener = new MqttListener();
        const fake = sinon.fake();
        const removeFn = listener.addHandler({
            topicFilter: 'devices/garden/lights',
            handle: fake,
        });
        const message = {
            topic: 'devices/garden/lights',
            payload: Buffer.alloc(0),
        };
        await listener.handleMessage(message);
        assert.isTrue(fake.calledOnce);
        removeFn();
        await listener.handleMessage(message);
        assert.isTrue(fake.calledOnce);
    });
});
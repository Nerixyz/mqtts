import {
    createFlowCounter,
    extractParams,
    isPublish,
    matchTopic,
    nullOrUndefined,
    PublishAckPacket,
    PublishRequestPacket,
    resolve, toMqttTopicFilter,
} from './index';
import { assert } from 'chai';

describe('matchTopic', function() {
    it('should match the topic', function() {
        assert.isTrue(matchTopic('devices/+/colors/+', 'devices/light/colors/red'));
        assert.isTrue(matchTopic('devices/light/colors/red', 'devices/light/colors/red'));
    });
    it('should only match the topic', function() {
        assert.isFalse(matchTopic('devices/+/colors/+', 'devices/light/color/red'));
        assert.isFalse(matchTopic('devices/+/colors/+', 'device/light/colors/red'));
    });
});

describe('extractParams', function() {
    it('should extract the correct params', function() {
        assert.deepStrictEqual(extractParams(':placeId/lights/:lightId/state', 'garden/lights/1/state'), {placeId: 'garden', lightId: '1'});
    });
});

describe('nullOrUndefined', function() {
    it('should work', function() {
        assert.isTrue(nullOrUndefined(null));
        assert.isTrue(nullOrUndefined(undefined));
        assert.isFalse(nullOrUndefined(''));
        assert.isFalse(nullOrUndefined({}));
    });
});

describe('isPublish', function() {
    it('should work', function() {
        assert.isTrue(isPublish(new PublishRequestPacket(0, '', undefined, Buffer.alloc(0))));
        assert.isFalse(isPublish(new PublishAckPacket(0)));
    });
});

describe('resolve', function() {
    it('should return the input if it is not a function', async function() {
        const input = {};
        assert.strictEqual(await resolve(input), input);
    });
    it('should invoke the function', async function() {
        const input = {};
        assert.strictEqual(await resolve(() => input), input);
    });
    it('should invoke the function and await the promise', async function() {
        const input = {};
        assert.strictEqual(await resolve(async () => input), input);
    });
});

describe('toMqttTopicFilter', function() {
    it('should return a valid mqtt topic', function() {
        assert.deepStrictEqual(toMqttTopicFilter('devices/garden/lights/1'), ['devices/garden/lights/1']);
    });
    it('should return a topicFilter if parameters are found in the string', function() {
        assert.deepStrictEqual(toMqttTopicFilter('devices/garden/lights/:lightId/state'),
            ['devices/garden/lights/+/state', 'devices/garden/lights/:lightId/state'])
    });
});

describe('createFlowCounter', function() {
    it('should return a new count once next is called', function() {
        const counter = createFlowCounter();
        assert.strictEqual(counter.next(), globalThis.BigInt && globalThis.BigInt(1) || 1);
        assert.strictEqual(counter.next(), globalThis.BigInt && globalThis.BigInt(2) || 2);
    });
})

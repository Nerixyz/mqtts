import { extractParams, matchTopic } from '../src';

describe('Utilities', function() {
    it('matches the topic', function() {
        expect(matchTopic('devices/+/colors/+', 'devices/light/colors/red')).toBe(true);
        expect(matchTopic('devices/light/colors/red', 'devices/light/colors/red')).toBe(true);
    });
    it('only matches the topic', function() {
        expect(matchTopic('devices/+/colors/+', 'devices/light/color/red')).not.toBe(true);
        expect(matchTopic('devices/+/colors/+', 'device/light/colors/red')).not.toBe(true);
    });
    it('extracts the correct values', function() {
        const result = extractParams('devices/:deviceName/colors/:color', 'devices/light/color/red');
        expect(result).toStrictEqual({deviceName: 'light', color: 'red'});
    })
});
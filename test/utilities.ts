import { assert } from 'chai';

export async function assertIteratorValue<T>(iterator: AsyncIterableIterator<T>, assertValue: (value: T) => boolean | void) {
    const next = await iterator.next();
    assert.strictEqual(next.done, false, 'A value is expected from the iterator.');
    const valueAssertion = assertValue(next.value);
    if(typeof valueAssertion !== 'undefined') {
        assert(valueAssertion, 'The value assertion failed.');
    }
}

export function assertIteratorValueInstanceOf<T>(iterator: AsyncIterableIterator<T>, proto: {new(...args: any[]): T}) {
    return assertIteratorValue(iterator, value => assert.instanceOf(value, proto));
}

export async function assertIteratorDone(iterator: AsyncIterableIterator<unknown>) {
    const next = await iterator.next();
    assert.deepStrictEqual(next, {done: true, value: undefined}, 'The iterator is expected to be done');
}

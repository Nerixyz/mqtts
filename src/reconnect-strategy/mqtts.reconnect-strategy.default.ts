import { MqttsReconnectStrategy } from './mqtts.reconnect-strategy';
import { ConnectError } from '../errors';
import { promisify } from 'util';
const sleep = promisify(setTimeout);

export class MqttsReconnectStrategyDefault implements MqttsReconnectStrategy {
    /**
     * Internal attempts counter
     */
    #attempts = 1;
    constructor(
        /**
         * Maximum attempts amount
         */
        private maximum: number = 60,
        /**
         * Interval between attempts, milliseconds
         */
        private interval: number = 1000,
    ) {}
    check(reason?: any) {
        if (reason instanceof ConnectError) {
            return ['IdentifierRejected', 'ServerUnavailable'].includes(reason.status);
        }
        if (typeof reason === 'string' && ['Soft disconnect', 'Forced disconnect'].includes(reason)) {
            return false;
        }
        return this.#attempts <= this.maximum;
    }

    wait() {
        this.#attempts++;
        return sleep(this.interval);
    }
    reset() {
        this.#attempts = 1;
    }
}

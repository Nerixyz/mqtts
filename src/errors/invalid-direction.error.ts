import { CustomError } from 'ts-custom-error';

export class InvalidDirectionError extends CustomError {
    constructor(usedDirection: string) {
        super(`Invalid direction: ${usedDirection}`);
    }
}

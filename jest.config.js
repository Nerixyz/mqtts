/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    testEnvironment: 'node',
    testRegex: ['.*.spec.ts$'],
    testPathIgnorePatterns: ['dist'],
    transform: {
        '^.+\\.(t|j)sx?$': '@swc/jest',
    },
};

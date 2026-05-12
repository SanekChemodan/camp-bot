export const getRandomInt = (max: number): number => {
    return Math.floor(Math.random() * max);
};

export const getRandomId = (): number => {
    return Math.floor(Math.random() * 2_147_483_647);
};
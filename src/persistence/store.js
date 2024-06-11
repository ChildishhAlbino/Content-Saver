export const write = (key, data) => {
    try {
        localStorage.setItem(key, data);
        return data
    } catch (error) {
        console.error(error);
        throw error;
    }
}

export const get = (key) => {
    if (key) {
        return localStorage[key]
    } else {
        return Object.freeze({ ...localStorage });
    }
}

const clearAll = () => {
    localStorage.clear()
}

const clearKey = (key) => {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error(error);
        throw error;
    }
}

export const clear = (key) => {
    if (key) {
        clearKey(key);
    } else {
        clearAll()
    }
}
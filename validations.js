// Input validtion functions

exports.onlyAlphaNum = (str, allowedChars = []) => {
    return str.match("^[A-Za-z0-9" + allowedChars.join('') + "]+$");
}
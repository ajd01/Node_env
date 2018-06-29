import 'whatwg-fetch'

export function getUsers() {
    return getUrl('users')
}

function getUrl(url) {
    const fetcha = fetch(url).then(onSuccess, onError)
    return fetcha 
}

function onSuccess(res) {
    console.log(res)
    return res.json()
}

function onError(err) {
    console.log(err)//eslint-disable-line no-console
}
import numeral from 'numeral'
import './index.css'
import {getUsers} from './api/user.js'

const courseVale = numeral(1000).format('$0,0.00')
//debugger
console.log(`I would pay ${courseVale} aaaaaa`)



getUsers().then(res => {
    let userBody = ""
    res.forEach(user => {
        userBody += `
        <tr id="${user.id}">
            <td>
                ${user.name}
            </td>
            <td>
                ${user.email}
            <td>   
        </tr>
        `
    })
    global.document.getElementById('users').innerHTML = userBody
})



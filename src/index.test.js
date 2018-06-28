import {expect} from 'chai'
import jsdom from 'jsdom'
import fs from 'fs'

describe('First test', () => {
    it('shold pass', () => {
        expect(true).to.equal(true)
    })
})

describe('Whole new test', () => {
    it('should test the new test', () => {
        expect(2+2).to.equal(4)
    })
})


describe('index.html', () => {
    it('shold say _|__|_', (done) => {
        const index = fs.readFileSync('./src/index.html',"utf-8")
        jsdom.env(index, function(err, window) {
            const h1 = window.document.getElementsByTagName('h1')[0]
            expect(h1.innerHTML).to.equal('_|__|_')
            done()
            window.close()
        })
    })
})
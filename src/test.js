/*
'use strict'

const _ = require('lodash')
const request = require('supertest')
const {assert} = require('chai')
const nock = require('nock')

const app = require('../../app')
const setup = require('../hooks')
const stubIam = require('../stubIam')
const mockIam = require('../factories/mocks/iam')
const stub = require('../stub')
const stubCrm = require('../stubCrm')

const agent = request.agent(app)

function findPhysicianByEmail (physicians = [], email) {
  return physicians.find(_physician => _physician.email === email)
}

function matchCRMBody (order) {
  const physicianFromOrder = Object.assign({}, order.physician)

  if (physicianFromOrder.physicianId) {
    physicianFromOrder.id = physicianFromOrder.physicianId
  }

  if (physicianFromOrder.facilityId) {
    physicianFromOrder.facId = physicianFromOrder.facilityId
  }

  return function ({physician}) {
    return _.matches(physician, physicianFromOrder)
  }
}

describe('Functional: Online Ordering - physiciansAddressBook', function () {
  this.timeout(0)

  const sessionsMeMock = mockIam.createSessionMe({
    physicianIdList: ['-22222', '-22223'],
    medicalFacilityId: '222222',
    medicalFacilityIdList: ['222222']
  })

  const providerListMock = mockIam.createProviders([
    {id: '-22222', facilityId: '222222'},
    {id: '-22223', facilityId: '222222'}
  ])

  const mockedPhysicians = {
    withPhysicianId: [],
    withNoPhysicianId: []
  }

  const ORDER = Object.assign({}, _.cloneDeep(setup.order))

  let authStub

  function getAddressBook () {
    return agent
      .get('/api/v1/orders/physiciansAddressBook')
      .expect(200)
  }

  function submitOrder (order) {
    stubCrm
      .post('', matchCRMBody(order))
      .reply(200, {})

    return agent
      .post('/api/v1/orders')
      .send(order)
      .expect(200)
  }

  before((done) => {
    setup.setupDb()
      .then(() => {
        return setup.userToTestGetPhysicians1
      })
      .then(user => {
        mockedPhysicians.withPhysicianId.push({
          physicianId: user.physicianId,
          facilityId: user.medicalFacilityId,
          institution: 'Facility 1',
          firstName: user.firstName,
          lastName: user.lastName,
          address: 'Address 1',
          zipCode: '11111',
          cityState: 'State 1',
          country: 'USA',
          email: user.email,
          phoneNumber: '(555) 555-5555',
          faxNumber: '(777) 777-7777'
        })
        mockedPhysicians.withNoPhysicianId.push({
          physicianId: '',
          facilityId: '',
          institution: 'Facility 2',
          firstName: 'Rick',
          lastName: 'Chihu',
          address: 'Address 2',
          zipCode: '22222',
          cityState: 'State 2',
          country: 'USA',
          email: 'rick@example.com',
          phoneNumber: '(123) 123-1234',
          faxNumber: '(789) 789-7897'
        })
        return done()
      })
      .catch(done)
  })

  beforeEach(() => {
    authStub = stub()

    authStub.callsFake(function (req, res, next) {
      req.user = sessionsMeMock
      next()
    })

    stubIam
      .get('/api/v1/provider/list')
      .times(4)
      .reply(200, providerListMock)
  })

  afterEach((done) => {
    authStub.restore()
    nock.cleanAll()
    setup.removeCollection('physiciansaddressbooks').then(() => {
      done()
    })
      .catch(done)
  })

  it('should successfully get the current saved Physicians in the Address Book', function (done) {
    getAddressBook()
      .then(function ({body}) {
        assert.isArray(body, 'result is an array')
        assert.lengthOf(body, 2, 'assert that the two previously stored physicians are return by the address book')
        return done()
      })
      .catch(done)
  })

  it('should save and update a new physician in the Address Book that does NOT have a "physicianId"', function (done) {
    const newPhysician = Object.assign({}, mockedPhysicians.withNoPhysicianId[0])
    const order = Object.assign({}, ORDER, {physician: newPhysician})
    let updatedPhysician

    submitOrder(order)
      .then(getAddressBook)
      .then(function ({body}) {
        assert.isArray(body, 'result is an array')
        assert.lengthOf(body, 3, 'assert that there are two physicians plus the new recently added')
        const savedPhysician = findPhysicianByEmail(body, newPhysician.email)
        assert.exists(savedPhysician, 'physician should be returned in the address book')
        const expectedPhysician = Object.assign({}, newPhysician, {
          _id: savedPhysician._id,
          palmetto: savedPhysician.palmetto
        })
        assert.deepEqual(savedPhysician, expectedPhysician, 'physician should have been saved correctly')
      })
      .then(function () {
        updatedPhysician = {
          physicianId: '',
          facilityId: '',
          firstName: newPhysician.firstName.toLowerCase(),
          lastName: newPhysician.lastName.toLowerCase(),
          institution: 'new Facility',
          address: 'new Address',
          zipCode: '00000',
          cityState: 'new State',
          country: 'new country',
          email: 'new_email@example.com',
          phoneNumber: '(000) 000-0000',
          faxNumber: '(999) 999-9999'
        }
        const order2 = Object.assign({}, ORDER, {physician: updatedPhysician})

        return submitOrder(order2).then(getAddressBook)
      })
      .then(function ({body}) {
        assert.isArray(body, 'result is an array')
        assert.lengthOf(body, 3, 'assert that there are still three physicians')
        const savedPhysician = findPhysicianByEmail(body, updatedPhysician.email)
        assert.exists(savedPhysician, 'physician should be returned in the address book')
        const expectedPhysician = Object.assign({}, updatedPhysician, {
          _id: savedPhysician._id,
          palmetto: savedPhysician.palmetto
        })
        assert.deepEqual(savedPhysician, expectedPhysician, 'physician should have been updated correctly')
        updatedPhysician.addressBookId = savedPhysician._id

        return agent.get('/api/v1/saved-orders').expect(200)
      })
      .then(({body}) => {
        assert.isObject(body, 'result is an object')
        assert.property(body, 'prevOrderData', 'result has a property "prevOrderData"')
        const {prevOrderData} = body
        const expectedPrevOrderData = Object.assign({}, prevOrderData, {
          physicianAddressBookId: updatedPhysician.addressBookId,
          physicianId: updatedPhysician.physicianId,
          physicianFacilityId: updatedPhysician.facilityId,
          physicianInstitution: updatedPhysician.institution,
          physicianFirstName: updatedPhysician.firstName,
          physicianLastName: updatedPhysician.lastName,
          physicianAddress: updatedPhysician.address,
          physicianCityState: updatedPhysician.cityState,
          physicianZipCode: updatedPhysician.zipCode,
          physicianCountry: updatedPhysician.country,
          physicianPhoneNumber: updatedPhysician.phoneNumber,
          physicianFaxNumber: updatedPhysician.faxNumber,
          physicianEmail: updatedPhysician.email
        })
        assert.deepEqual(prevOrderData, expectedPrevOrderData, 'prevOrderData should be updated')

        return done()
      })
      .catch(done)
  })

  it('should save and update a new physician in the Address Book with a "physicianId"', function (done) {
    const newPhysician = Object.assign({}, mockedPhysicians.withPhysicianId[0])
    const order = Object.assign({}, ORDER, {physician: newPhysician})
    let updatedPhysician
    let updatedPhysician2

    submitOrder(order)
      .then(getAddressBook)
      .then(function ({body}) {
        assert.isArray(body, 'result is an array')
        assert.lengthOf(body, 2, 'assert that there are still two physicians')
        const savedPhysician = findPhysicianByEmail(body, newPhysician.email)
        assert.exists(savedPhysician, 'physician should be returned in the address book')
        const expectedPhysician = Object.assign({}, newPhysician, {
          _id: savedPhysician._id,
          palmetto: savedPhysician.palmetto
        })
        assert.deepEqual(savedPhysician, expectedPhysician, 'physician should have been saved correctly')
      })
      .then(function () {
        updatedPhysician = {
          physicianId: newPhysician.physicianId,
          facilityId: newPhysician.facilityId,
          firstName: newPhysician.firstName,
          lastName: newPhysician.lastName,
          institution: 'new Facility',
          address: 'new Address',
          zipCode: '00000',
          cityState: 'new State',
          country: 'new Country',
          email: 'new_email@fmi.com',
          phoneNumber: '(000) 000-0000',
          faxNumber: '(999) 999-9999'
        }
        const order2 = Object.assign({}, ORDER, {physician: updatedPhysician})

        return submitOrder(order2).then(getAddressBook)
      })
      .then(function ({body}) {
        assert.isArray(body, 'result is an array')
        assert.lengthOf(body, 2, 'assert that there are still two physicians')
        const savedPhysician = findPhysicianByEmail(body, updatedPhysician.email)
        assert.exists(savedPhysician, 'physician should be returned in the address book')
        const expectedPhysician = Object.assign({}, updatedPhysician, {
          _id: savedPhysician._id,
          palmetto: savedPhysician.palmetto,
          // these values should have been kept
          physicianId: newPhysician.physicianId,
          facilityId: newPhysician.facilityId,
          firstName: newPhysician.firstName,
          lastName: newPhysician.lastName
        })
        assert.deepEqual(savedPhysician, expectedPhysician, 'physician should have been updated correctly')
      })
      .then(function () {
        // update physician one more time with lower case name
        updatedPhysician2 = {
          physicianId: newPhysician.physicianId,
          facilityId: newPhysician.facilityId,
          firstName: newPhysician.firstName.toLowerCase(),
          lastName: newPhysician.lastName.toLowerCase(),
          institution: 'new Facility 2',
          address: 'new Address 2',
          zipCode: '00002',
          cityState: 'new State 2',
          country: 'new Country 2',
          email: 'new_email2@fmi.com',
          phoneNumber: '(000) 000-0002',
          faxNumber: '(999) 999-9992'
        }
        const order3 = Object.assign({}, ORDER, {physician: updatedPhysician2})

        return submitOrder(order3).then(getAddressBook)
      })
      .then(function ({body}) {
        assert.isArray(body, 'result is an array')
        assert.lengthOf(body, 2, 'assert that there are still two physicians when updating name in lower case')
        const savedPhysician2 = findPhysicianByEmail(body, updatedPhysician2.email)
        assert.exists(savedPhysician2, 'savedPhysician2 should be returned in the address book')
        const expectedPhysician2 = Object.assign({}, updatedPhysician2, {
          _id: savedPhysician2._id,
          palmetto: savedPhysician2.palmetto,
          // these values should have not changed
          physicianId: newPhysician.physicianId,
          facilityId: newPhysician.facilityId,
          // name will be saved in lowerCase and that's ok
          firstName: updatedPhysician2.firstName,
          lastName: updatedPhysician2.lastName
        })
        assert.deepEqual(savedPhysician2, expectedPhysician2, 'physician should have been updated correctly one more time')
        updatedPhysician2.addressBookId = savedPhysician2._id

        return agent.get(`/api/v1/saved-orders`).expect(200)
      })
      .then(({body}) => {
        assert.isObject(body, 'result is an object')
        assert.property(body, 'prevOrderData', 'result has a property "prevOrderData"')
        const {prevOrderData} = body
        const expectedPrevOrderData = Object.assign({}, prevOrderData, {
          // these data should have been changed
          physicianId: newPhysician.physicianId,
          physicianFacilityId: newPhysician.facilityId,
          // updated data
          physicianFirstName: updatedPhysician2.firstName,
          physicianLastName: updatedPhysician2.lastName,
          physicianAddressBookId: updatedPhysician2.addressBookId,
          physicianInstitution: updatedPhysician2.institution,
          physicianAddress: updatedPhysician2.address,
          physicianCityState: updatedPhysician2.cityState,
          physicianZipCode: updatedPhysician2.zipCode,
          physicianCountry: updatedPhysician2.country,
          physicianPhoneNumber: updatedPhysician2.phoneNumber,
          physicianFaxNumber: updatedPhysician2.faxNumber,
          physicianEmail: updatedPhysician2.email
        })
        assert.deepEqual(prevOrderData, expectedPrevOrderData, 'prevOrderData should be updated')

        return done()
      })
      .catch(done)
  })

  it('should save a physician twice in the Address Book if name has a typo', function (done) {
    const newPhysician = Object.assign({}, mockedPhysicians.withNoPhysicianId[0])
    const order = Object.assign({}, ORDER, {physician: newPhysician})

    submitOrder(order)
      .then(getAddressBook)
      .then(function ({body}) {
        assert.isArray(body, 'result is an array')
        assert.lengthOf(body, 3, 'assert that there are two physicians plus the new recently added')
        const savedPhysician = findPhysicianByEmail(body, newPhysician.email)
        assert.exists(savedPhysician, 'physician should be returned in the address book')
        const expectedPhysician = Object.assign({}, newPhysician, {
          _id: savedPhysician._id,
          palmetto: savedPhysician.palmetto
        })
        assert.deepEqual(savedPhysician, expectedPhysician, 'physician should have been added correctly - case insensitive')
      })
      .then(function () {
        newPhysician.firstName = newPhysician.firstName + 's' // intended typo
        newPhysician.email = 'newEmail@example.com'
        const order2 = Object.assign({}, ORDER, {physician: newPhysician})

        return submitOrder(order2).then(getAddressBook)
      })
      .then(function ({body}) {
        assert.isArray(body, 'result is an array')
        assert.lengthOf(body, 4, 'assert that there are now four physicians')
        const savedPhysician = findPhysicianByEmail(body, newPhysician.email)
        assert.exists(savedPhysician, 'physician should be returned in the address book')
        const expectedPhysician = Object.assign({}, newPhysician, {
          _id: savedPhysician._id,
          palmetto: savedPhysician.palmetto
        })
        assert.deepEqual(savedPhysician, expectedPhysician, 'physician should have been updated correctly')

        return done()
      })
      .catch(done)
  })

  it('should update a physician twice in the Address Book if name has a typo', function (done) {
    const newPhysician = Object.assign({}, mockedPhysicians.withNoPhysicianId[0])
    newPhysician.firstName = "Robert"
    newPhysician.lastName = "Wolks"
    const order = Object.assign({}, ORDER, {physician: newPhysician})
    submitOrder(order)
      .then(getAddressBook)
      .then(function ({body}) {
        assert.isArray(body, 'result is an array')
        assert.lengthOf(body, 3, 'assert that there are two physicians plus the new recently added')
      })
    
    const newPhysician = Object.assign({}, mockedPhysicians.withPhysicianId[0])
    newPhysician.firstName = "Robert"
    newPhysician.lastName = "Wolks"
    const order = Object.assign({}, ORDER, {physician: newPhysician})
    submitOrder(order)
      .then(getAddressBook)
      .then(function ({body}) {
        assert.isArray(body, 'result is an array')
        assert.lengthOf(body, 3, 'assert that there same three physicians now ehit ID')
        //Loock for the name and chek is it have the new ID
      })
    
  })


})
*/
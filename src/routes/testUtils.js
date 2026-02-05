const { Role, DB } = require('../database/database.js');

const request = require('supertest');
const app = require('../service');

async function createAdmin() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + '@admin.com'

    user = await DB.addUser(user);
    return { ...user, password: 'toomanysecrets' };
}

function randomName () {
    return Math.random().toString(36).substring(2, 12);
}

function expectValidJwt(potentialJwt) {
    expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}


async function createFranchise(userToken, userEmail) {
    
    let newFranchiseName = `${randomName()}` + `testFranchise`
    const newFranchiseRes = await request(app).post('/api/franchise')
    .set({
        "Content-type" : "application/json", 
        "Authorization" : `Bearer ${userToken}`
    }).send(
        {
            "name" : newFranchiseName,
            "admins": [{"email" : `${userEmail}`}]
        }
    )

    return {
        newFranchiseRes: newFranchiseRes,
        newFranchiseName: newFranchiseName
    };
}

async function createStore(franchiseID, adminToken) {
    let newStoreName = randomName() + `TestStore`;
    const createStoreRes = await request(app).post(`/api/franchise/${franchiseID}/store`)
    .set({'Content-Type': 'application/json',
        'Authorization' : `Bearer ${adminToken}`
    })
    .send({
        "franchiseId" : `${franchiseID}`,
        "name" : `${newStoreName}`
    });

    return {
        createStoreRes: createStoreRes,
        newStoreName: newStoreName
    };
}

module.exports = {
    createAdmin,
    randomName,
    expectValidJwt,
    createFranchise,
    createStore
}
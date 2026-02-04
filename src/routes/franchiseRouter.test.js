const {createAdmin, expectValidJwt, randomName} = require("./testUtils.js");

const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };

let testUserAuthToken;
let testUserId

let adminUser;
let adminUserAuthToken;

beforeAll(async () => {
    testUser.email = Math.random().toString(36).substring(2,12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    testUserId = registerRes.body.user.id
    expectValidJwt(testUserAuthToken);

    adminUser = await createAdmin();
    console.log(adminUser);
    const adminLoginRes = await request(app).put('/api/auth').send(adminUser);
    expect(adminLoginRes.status).toBe(200);
    expectValidJwt(adminLoginRes.body.token);
    adminUserAuthToken = adminLoginRes.body.token;
});

async function createFranchise() {
    
    let newFranchiseName = `${randomName()}` + `testFranchise`
    const newFranchiseRes = await request(app).post('/api/franchise')
    .set({
        "Content-type" : "application/json", 
        "Authorization" : `Bearer ${adminUserAuthToken}`
    }).send(
        {
            "name" : newFranchiseName,
            "admins": [{"email" : `${adminUser.email}`}]
        }
    )

    return {
        newFranchiseRes: newFranchiseRes,
        newFranchiseName: newFranchiseName

    };
}

test('getUserFranchises', async () => {
    const getFranchisesRes = await request(app).get(`/api/franchise/${testUserId}`).set({'Authorization': `Bearer ${testUserAuthToken}`});
    expect(getFranchisesRes.body).toMatchObject([]);

});

test('createFranchise', async () => {
    const {newFranchiseRes, newFranchiseName } = await createFranchise();
    expect(newFranchiseRes.status).toBe(200);
    expect(newFranchiseRes.body.name).toBe(newFranchiseName);
    expect(newFranchiseRes.body.admins[0]).toHaveProperty('email', adminUser.email);
});
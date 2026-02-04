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
    const adminLoginRes = await request(app).put('/api/auth').send(adminUser);
    expect(adminLoginRes.status).toBe(200);
    expectValidJwt(adminLoginRes.body.token);
    adminUserAuthToken = adminLoginRes.body.token;
});

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

test('getFranchises', async () => {
    await createFranchise();
    const getFranchisesRes = await request(app).get('/api/franchise?page=0&limit=10&name=*');
    expect(getFranchisesRes.status).toBe(200);
    expect(getFranchisesRes.body.franchises.length >= 1);
})

test('getUserFranchises', async () => {
    const getUserFranchisesRes = await request(app).get(`/api/franchise/${testUserId}`).set({'Authorization': `Bearer ${testUserAuthToken}`});
    expect(getUserFranchisesRes.body).toMatchObject([]);
});

test('createFranchise', async () => {
    const {newFranchiseRes, newFranchiseName } = await createFranchise(adminUserAuthToken, adminUser.email);
    expect(newFranchiseRes.status).toBe(200);
    expect(newFranchiseRes.body.name).toBe(newFranchiseName);
    expect(newFranchiseRes.body.admins[0]).toHaveProperty('email', adminUser.email);
});

test('createFranchiseNonAdmin', async () => {
    let {newFranchiseRes} = await createFranchise(testUserAuthToken, testUser.email)
    expect(newFranchiseRes.status).toBe(403);
    expect(newFranchiseRes.body.message).toBe("unable to create a franchise");
});


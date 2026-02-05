const {createAdmin, expectValidJwt, randomName} = require("./testUtils.js");

const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };

let testUserAuthToken;
let testUserId

let adminUser;
let adminUserAuthToken;
let adminUserId;

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
    adminUserId = adminLoginRes.body.user.id;
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
    const getUserNoFranchisesRes = await request(app).get(`/api/franchise/${testUserId}`).set({'Authorization': `Bearer ${testUserAuthToken}`});
    expect(getUserNoFranchisesRes.body).toMatchObject([]);

    const { newFranchiseName } = await createFranchise(adminUserAuthToken, adminUser.email);
    const getAdminFranchiseRes = await request(app).get(`/api/franchise/${adminUserId}`).set({'Authorization' : `Bearer ${adminUserAuthToken}`});
    console.log(getAdminFranchiseRes.body);
    expect(getAdminFranchiseRes.body[0].name).toBe(newFranchiseName);
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

test('deleteFranchise', async () => {
    const {newFranchiseRes} = await createFranchise(adminUserAuthToken, adminUser.email);
    const deleteFranchiseRes = await request(app).delete(`/api/franchise/${newFranchiseRes.body.id}`).set({'Authorization':`Bearer ${adminUserAuthToken}`});
    expect(deleteFranchiseRes.status).toBe(200);
    expect(deleteFranchiseRes.body.message).toBe("franchise deleted");
});

async function createStore(franchiseID) {
    let newStoreName = randomName() + `TestStore`;
    const createStoreRes = await request(app).post(`/api/franchise/${franchiseID}/store`)
    .set({'Content-Type': 'application/json',
        'Authorization' : `Bearer ${adminUserAuthToken}`
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

test('createStore', async() => {
    const {newFranchiseRes} = await createFranchise(adminUserAuthToken, adminUser.email);
    const { createStoreRes, newStoreName } = await createStore(newFranchiseRes.body.id);
    expect(createStoreRes.status).toBe(200)
    expect(createStoreRes.body.name).toBe(newStoreName);  
});

test('deleteStore', async () => {
    const {newFranchiseRes} = await createFranchise(adminUserAuthToken, adminUser.email);
    const {createStoreRes, newStoreName} = await createStore(newFranchiseRes.body.id);
    expect(createStoreRes.status).toBe(200);

    const deleteStoreRes = await request(app).delete(`/api/franchise/${newFranchiseRes.body.id}/store/${createStoreRes.body.id}`)
        .set({'Authorization' : `Bearer ${adminUserAuthToken}`});
    expect(deleteStoreRes.status).toBe(200);
    expect(deleteStoreRes.body).toMatchObject({message : 'store deleted'})
})


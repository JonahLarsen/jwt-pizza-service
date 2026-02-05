const {createAdmin, expectValidJwt, randomName} = require("./testUtils.js");

const request = require('supertest');
const app = require('../service');


test('getMenu', async () => {
    const getMenuRes = await request(app).get('/api/order/menu');
    expect(getMenuRes.status).toBe(200);
    expect(getMenuRes.body[0]).toMatchObject(
        { 
            id: 1, title: 'Veggie', 
            image: 'pizza1.png', 
            price: 0.0038, 
            description: 'A garden of delight' 
        }
    )
})
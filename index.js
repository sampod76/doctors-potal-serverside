const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config()
const stripe = require("stripe")(process.env.STRIPE_KEY)

// console.log(process.env.STRIPE_KEY)

// meddil werd 
app.use(cors())
app.use(express.json())

const port = process.env.PORT || 5000;


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.9yhpi6m.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const appointmentOptionCollection = client.db('doctorsPortal').collection('appointmentOption')
const bookingsCollection = client.db('doctorsPortal').collection('bookingsOption')
const usersCollection = client.db('doctorsPortal').collection('users')
const doctorsCollection = client.db('doctorsPortal').collection('dotors')
const paymentsCollection = client.db('doctorsPortal').collection('payments')

/*

const run = async () => {
    try {
        await client.connect()
        console.log('this client connect')

    } catch (error) {
        console.log(error.message);
    }

}
run().catch(err => console.log(err.message))

*/

const verifyJwt = (req, res, next) => {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).send({ success: false, message: 'unauthorization' })
    }
    jwt.verify(authHeader, process.env.JWT_KEY, (error, decoded) => {
        if (error) {
            return res.status(403).send({
                success: false,
                message: 'forbidden access'
            })
        }
        // console.log(decoded);
        req.decoded = decoded
        next()

    })

}

//veryfi admin 

const verifyAdmin = async (req, res, next) => {
    const decodedEmial = req.decoded.email
    const gitUser = await usersCollection.findOne({ email: decodedEmial })
    if (gitUser?.role !== 'admin') {
        return res.status(401).send({
            success: false,
            message: 'You are not admin'
        })
    }
    next()
}


app.get('/jwt', async (req, res) => {
    const email = req.query.email;
    // console.log(email);

    try {
        const query = { email: email }
        const user = await usersCollection.findOne(query)
        if (user) {

            const token = jwt.sign({ email }, process.env.JWT_KEY, { expiresIn: '30d' })
            res.send({
                success: true,
                token
            })
        } else {
            res.status(403).send({
                success: false,
                message: 'unauthorized, user not found database'
            })
        }


    } catch (error) {
        res.send({
            success: false,
            message: error.message
        })
    }
})


app.get('/appointmentOption', async (req, res) => {
    const dates = req.query.date
    // console.log(dates)

    try {
        const options = await appointmentOptionCollection.find({}).toArray()
        // ক্লায়েন্ট  থেকে আমি আজকের যে ডেট পাঠাব ওই ডেটটা অনুসারে সে মোট বুকিং থেকে ওই ডেটের দিন গুলো সেগুলো তো খুজবে
        const bookingQuery = { appointmentDate: dates }
        const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray()

        // প্রথমত আমার সবগুলা অপশন অ্যাপোয়েন্টমেন্ট এর নাম গুলা একটা একটা করে পাঠাবে
        options.forEach(optionSingle => {
            // এইখানে আজকের দিনের যত বুকিং হইছে সবগুলা নামের সাথে অপশন (optionSingle) এর নাম মিলাবো
            const optionBooking = alreadyBooked.filter(book => book.treatment === optionSingle.name)
            // আজকের দিনে specific একটার যতগুলা বুকিং হইছে ওগুলোর মধ্যে একটা টাইম স্লট আছে শুধুমাত্র ওই ওই টাইম স্লট নেওয়া হবে (8:30-9:30)
            const bookingSlots = optionBooking.map(book => book.slot)

            // specific একটার slots থেকে বুকিং হয়ে যাওয়া slotes গুলো বাদ দিয়ে বাকি গুলো নেওয়া হলো
            const remainingSlots = optionSingle.slots.filter(slot => !bookingSlots.includes(slot))

            // specific একটার slots সবগুলোকে বাদ দিয়ে নতুন যেটা পাওয়া গেছে যেটাতে শুধু বুকিং ছাড়া গুলো আছে ওগুলো এক সেট করে দেয়া হলো
            optionSingle.slots = remainingSlots


            // note:  একটা জিনিস মনে রাখতে হবে যখন আমি ডাটাবেস থেকেই সবগুলো ডাটা এনে options এইখানে রাখলাম তখন ওইখান থেকে চেঞ্জ চেঞ্জ যা করার করছি কিন্তু সেটা ডাটাবেজে চেঞ্জ হবে না
            // console.log(optionSingle.name ,remainingSlots.length )

        })

        // console.log(options)
        res.send({
            success: true,
            message: 'Successfull get datas',
            data: options
        })
    } catch (error) {
        res.send({
            success: false,
            message: error.message
        })
    }

})


//কোন একটা ডাটাবেজ থেকে সবগুলো ডাটা না নিয়ে নির্দিষ্ট কিছু ফিল্ড নেওয়া  
app.get('/appointmentSpecialty', async (req, res) => {
    try {
        const result = await appointmentOptionCollection.find({}).project({ name: 1 }).toArray()
        if (result) {
            res.send({
                success: true,
                data: result
            })
        }
    } catch (error) {
        res.send({
            success: false,
            message: error.message
        })
    }
})


app.get('/booking', verifyJwt, async (req, res) => {
    const email = req.query.email
    console.log(req.decoded)
    console.log(email)
    try {

        if (email !== req.decoded.email) {
            return res.status(403).send({ success: false, message: 'forbidden access' })
        }
        const query = {
            email: email
        }
        const bookingPerson = await bookingsCollection.find(query).toArray()
        // console.log(bookingPerson);

        if (bookingPerson.length) {
            res.send({
                success: true,
                message: 'This person booking find',
                data: bookingPerson

            })
        } else {
            res.send({
                success: false,
                message: 'this person no booking ??????'
            })
        }


    } catch (error) {
        res.send({
            success: false,
            message: error.message
        })
    }
})

app.get('/booking/:id', async (req, res) => {
    const id = req.params.id
    try {
        const booked = await bookingsCollection.findOne({ _id: ObjectId(id) })

        res.send({
            success: true,
            data: booked
        })

    } catch (error) {
        res.send({
            success: false,
            message: error.message
        })
    }
})


app.post('/booking', async (req, res) => {
    const booking = req.body
    try {

        // -------------------------------------------------
        // একই ব্যক্তি ,একই সেবাটা, একই দিনে, যদি আরেকবার নিতে চায় তাহলে তাকে নিচে দেয়া হবে না
        const quary = {
            email: booking.email, // একই ব্যক্তি
            appointmentDate: booking.appointmentDate, //একই দিনে
            treatment: booking.treatment //একই সেবাটা
        }
        const alreadyBookedThisPerson = await bookingsCollection.find(quary).toArray()
        // console.log(alreadyBookedThisPerson.length)
        if (alreadyBookedThisPerson.length) {
            return res.send({
                success: false,
                message: `You alrady booking this appointment`
            })
        }
        // ---------------------------------------------------

        const result = await bookingsCollection.insertOne(booking)

        if (result.insertedId) {
            res.send({
                success: true,
                message: 'Successfully Data Post',
                data: result
            })
        }
        else {
            res.send({
                success: false,
                message: 'This data is not post'
            })
        }
    } catch (error) {
        res.send({
            success: false,
            message: error.message
        })
    }
})


// pasent / user account infon

app.post('/user', async (req, res) => {
    const datas = req.body
    try {
        const usersDatas = await usersCollection.insertOne(datas)

        if (usersDatas.insertedId) {
            res.send({
                success: true,
                message: 'Sussceefull user create',
            })
        }
        else {
            res.send({
                success: false,
                message: 'user not create',
            })
        }
    } catch (error) {
        res.send({
            success: false,
            message: error.message
        })
    }
})

// all user 
app.get('/users',verifyJwt,verifyAdmin, async (req, res) => {
    try {
        const users = await usersCollection.find({}).toArray()

        res.send({
            success: true,
            data: users
        })
    } catch (error) {
        res.send({
            success: false,
            message: error.message
        })
    }
})

app.get('/user/admin/:email', async (req, res) => {
    const email = req.params.email
    try {
        const result = await usersCollection.findOne({ email })
        if (result?.role === 'admin') {
            res.send({
                success: true,
                isAdmin: 'admin'
            })
        } else {
            res.send({
                success: false,
                isAdmin: false
            })
        }
    } catch (error) {

    }
})

app.put('/users/admin/:id', verifyJwt, verifyAdmin, async (req, res) => {
    const id = req.params.id

    try {
        //----------- get user--

        const filter = { _id: ObjectId(id) }
        const options = { upsert: true };
        const updatedDoc = {
            $set: {
                role: 'admin'
            }
        }
        const result = await usersCollection.updateOne(filter, updatedDoc, options)
        // console.log(result)
        if (result.modifiedCount) {
            res.send({
                success: true,
                message: 'Successfull data update'
            })
        } else {
            res.send({
                success: false,
                message: 'Not posible admin sumthinks error'
            })
        }

    } catch (error) {
        res.send({
            success: false,
            message: error.message
        })
    }
})




//creaite doctos post
app.post('/doctors', verifyJwt, verifyAdmin, async (req, res) => {
    const doctorsUser = req.body
    try {
        const result = await doctorsCollection.insertOne(doctorsUser)
        if (result.insertedId) {
            res.send({
                success: true,
                message: 'User successful create'
            })
        } else {
            res.send({
                success: false,
                message: 'User not create'
            })
        }
    } catch (error) {
        res.send({
            success: false,
            message: error.message
        })
    }
})


// get doctors 
app.get('/doctors', verifyJwt, verifyAdmin, async (req, res) => {
    try {
        const doctors = await doctorsCollection.find({}).toArray()
        // console.log(doctors.length);
        // res.send(doctors)
        if (doctors.length > 0) {
            // console.log(doctors)
            res.send({
                success: true,
                data: doctors
            })
        } else {
            res.send({
                success: false,
                message: 'No doctors Found'
            })
        }
    } catch (error) {
        res.send({
            success: false,
            message: error.message + ' error'
        })
    }
})

//delete doctors 

app.delete('/doctors/:id', verifyJwt, verifyAdmin, async (req, res) => {
    const id = req.params.id
    try {
        // get user data base 
        const userEmail = await usersCollection.findOne({ email: decodedEmial })

        if (userEmail.email !== decodedEmial) {
            return res.send({
                success: false,
                message: 'You are not correct person '
            })
        }

        const result = await doctorsCollection.deleteOne({ _id: ObjectId(id) })
        if (result.deletedCount) {
            res.send({
                success: true,
                message: 'Successfully delete'
            })
        }
        else {
            res.send({
                success: false,
                message: 'Not posible delete'
            })
        }
    } catch (error) {
        res.send({
            success: false,
            message: error.message + ' error'
        })
    }
})


//payment mathod 

app.post('/create-payment-intent', async (req, res) => {
    const booking = req.body
    const price = parseFloat(booking.price)
    const amount = price * 100
    // console.log(amount)
    const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        "payment_method_types": [
            "card"
        ],
    });

    res.send({
        clientSecret: paymentIntent.client_secret,
    });
})

//pament mathod 
app.post('/payments', verifyJwt, async (req, res) => {
    const paymentData = req.body
    const decodedEmial = req.decoded.email

    try {

        // get user data base 
        const userEmail = await usersCollection.findOne({ email: decodedEmial })

        if (userEmail.email !== decodedEmial) {
            return res.send({
                success: false,
                message: 'You are not correct person this is payment '
            })
        }

        const result = await paymentsCollection.insertOne(paymentData)
        if (result.insertedId) {
            res.send({
                success: true,
                message: 'successfully data inside',
                insertedId: result.insertedId
            })
        } else {
            res.send({
                success: false,
                message: 'payment is not inside database'
            })
        }

    } catch (error) {
        res.send({
            success: false,
            message: error.message + ' error'
        })
    }
})


app.get('/', (req, res) => {
    res.send('This is run my server')
})

app.listen(port, () => {
    console.log(`this is run ${port}`);
})


const user = require("../db/models/user");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET_KEY, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });
}

const signup = catchAsync(async (req, res, next) => {
    const body = req.body;

    if (!['1', '2'].includes(body.userType)) {
        throw new AppError('invalid user Type', 400)
    }

    const newUser = await user.create({
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        password: body.password,
        confirmPassword: body.confirmPassword,
        userType: body.userType,
    });

    if (!newUser) {
        return next(new AppError('Failed to create new user', 400));
    }

    const result = newUser.toJSON();

    delete result.password;
    delete result.deletedAt;

    result.token = generateToken({
        id: result.id
    })

    return res.status(201).json({
        data: result,
        status: 'Success',
    });
})

const login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(new AppError('Please provide email and password', 400));
    }

    const result = await user.findOne({ where: { email } });
    if (!result || !(await bcrypt.compare(password, result.password))) {
        return next(new AppError('Incorrect email or password', 400));
    }

    const token = generateToken({
        id: result.id,
    });

    return res.json({
        status: 'success',
        token,
    });
});

const authentication = catchAsync(async (req, res, next) => {
    let idToken = '';
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        idToken = req.headers.authorization.split(' ')[1];
    }
    if (!idToken) {
        return next(new AppError('Please login to get access', 401));
    }
    const tokenDetail = jwt.verify(idToken, process.env.JWT_SECRET_KEY);

    const freshUser = await user.findByPk(tokenDetail.id);

    if (!freshUser) {
        return next(new AppError('User no longer exists', 400));
    }
    req.user = freshUser;
    return next();
});

const restrictTo = (...userType) => {
    const checkPermission = (req, res, next) => {
        if (!userType.includes(req.user.userType)) {
            return next(
                new AppError(
                    "You don't have permission to perform this action",
                    403
                )
            );
        };
        return next();
    };

    return checkPermission;
}

module.exports = { signup, login, authentication, restrictTo };
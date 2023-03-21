const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../../config/auth.json");
const crypto = require("crypto");
const mailer = require("../../models/mailer");

const User = require("../models/user");

const router = express.Router();

function generateToken(id) {
  const token = jwt.sign({ id }, config.secret, {
    expiresIn: 86400, // 1 day
  });

  return token;
}

router.post("/register", async (req, res) => {
  const { email } = req.body;

  try {
    if (await User.findOne({ email })) {
      return res.status(400).send({ error: "User already exists" });
    }
    const user = await User.create(req.body);
    user.password = undefined;

    return res.send({ user, token: generateToken(user.id) });
  } catch (err) {
    return res.status(400).send({ error: "Registration failed" });
  }
});

router.post("/authenticate", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return res.status(400).send({ error: "User not found" });
  }

  if (!(await bcrypt.compare(password, user.password))) {
    return res.status(400).send({ error: "Authentication failed" });
  }

  user.password = undefined;

  return res.send({ user, token: generateToken(user.id) });
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).send({ error: "User not found" });
    }

    const token = crypto.randomBytes(20).toString("hex");

    const now = new Date();
    now.setHours(now.getHours() + 1);

    await User.findByIdAndUpdate(user.id, {
      $set: {
        passwordResetToken: token,
        passwordResetExpires: now,
      },
    });

    mailer.sendMail(
      {
        to: email,
        from: "cesarolimpio@gmail.com",
        template: "forgot-password",
        context: { token },
      },
      (error) => {
        if (error) {
          console.log(error);
          return res.status(400).send({ error: "Error on send email" });
        }
      }
    );

    return res.status(200).send({ ok: true });
  } catch (err) {
    return res.status(400).send({ error: "Error on forgot password" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { email, token, password } = req.body;

  try {
    const user = await User.findOne({ email }).select(
      "+passwordResetToken passwordResetExpires"
    );

    if (!user) {
      return res.status(400).send({ error: "User not found" });
    }

    if (token !== user.passwordResetToken) {
      return res.status(400).send({ error: "Token invalid" });
    }

    const now = new Date();
    if (now > user.passwordResetExpires) {
      return res.status(400).send({ error: "Token expired" });
    }

    user.password = password;
    await user.save();

    return res.send();
  } catch (error) {
    console.log(error);
    return res.status(400).send({ error: "Error on reset password" });
  }
});

module.exports = (app) => app.use("/auth", router);

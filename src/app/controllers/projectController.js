const express = require("express");
const authMiddleware = require("../middlewares/auth");

const Project = require("../models/project");
const Task = require("../models/task");

const router = express.Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const projects = await Project.find().populate(["user", "tasks"]);

    return res.send({ projects });
  } catch (error) {
    return res.status(400).send({ error: "Internal server error" });
  }
});

router.get("/:projectId", async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId).populate([
      "user",
      "tasks",
    ]);

    return res.send({ project });
  } catch (error) {
    return res.status(400).send({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  const { title, description, tasks } = req.body;

  try {
    const project = await Project.create({
      title,
      description,
      user: req.userId,
    });

    await Promise.all(
      tasks.map(async (task) => {
        const projectTask = new Task({ ...task, project: project._id });
        await projectTask.save();
        project.tasks.push(projectTask);
      })
    );

    await project.save();

    return res.send({ project });
  } catch (error) {
    return res.status(400).send({ error: "Internal server error" });
  }
});

router.put("/:projectId", async (req, res) => {
  const { title, description, tasks } = req.body;

  try {
    const project = await Project.findByIdAndUpdate(
      req.params.projectId,
      {
        title,
        description,
      },
      { new: true }
    );

    project.tasks = [];

    await Task.deleteMany({ project: project._id });

    await Promise.all(
      tasks.map(async (task) => {
        const projectTask = new Task({ ...task, project: project._id });
        await projectTask.save();
        project.tasks.push(projectTask);
      })
    );

    await project.save();

    return res.send({ project });
  } catch (error) {
    return res.status(400).send({ error: "Internal server error" });
  }
});

router.delete("/:projectId", async (req, res) => {
  try {
    const project = await Project.findByIdAndRemove(req.params.projectId);
    await Task.deleteMany({ project: project._id });

    return res.send();
  } catch (error) {
    return res.status(400).send({ error: "Internal server error" });
  }
});

module.exports = (app) => app.use("/projects", router);

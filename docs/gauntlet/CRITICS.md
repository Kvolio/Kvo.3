# The Critics

## Why the builder does not judge

`docs/gauntlet/iteration-02.md` ends with this, written by the builder about its
own six-critic review:

> Every fault this round was found by something mechanical, three of them by
> tests that were not looking for them. But the two faults that most needed
> catching in iteration 01 were found by a person looking at a picture.
> Mechanical checks catch what they were pointed at and what happens to cross
> their path. Neither is the same as catching what is wrong.

And then it ran the same self-review again, and the owner found six more faults
by looking at the model — including a loader's hatch built round when the
builder's own enlargement of the blueprint had described it as "the
rounded-square, upper right".

That is the failure mode. A builder reviewing its own work checks the things it
was thinking about while building. It cannot check the things it was not.

**So the builder is disqualified from judging.** Every gauntlet from here runs
as separate critic subagents, defined in `.claude/agents/tiger-critic.md`, which
did not build the model and have no stake in it passing.

## Standing rules

1. **The critics are given the reference images and told to open them first**,
   before any render. A comparison made from memory is not a comparison.
2. **The standard is the War Thunder Tiger I model.** Not "recognisable as a
   tank" — accurate to someone who knows the vehicle.
3. **Any critical or major finding fails the build.** The builder fixes what the
   critics found. It does not argue with a finding, downgrade a severity, or
   decide a finding was mistaken without evidence stronger than the reference
   the critic used.
4. **The verdicts go into the iteration report verbatim**, including findings
   that were then fixed. Not summarised by the builder.

## Domains

| Critic | Judges | Given |
|---|---|---|
| Turret & gun | Turret shell, bustle, mantlet, gun, cupola, hatches, stowage | All references; three-quarter, front, plan and turret detail renders |
| Hull & glacis | Frontal plate arrangement, glacis, superstructure, engine deck, vision ports | All references; front, side, plan and detail renders |
| Running gear | Wheels, interleave, sprocket, idler, track, guards | All references; side, front and running-gear detail renders |
| Silhouette | The whole vehicle, at a glance, from every angle | All references; all five orthographic and four three-quarter views |

## The reference set

`/root/.claude/uploads/e07c3ef7-5cdd-5c0d-8702-a17320a506a4/` — the 1:50
orthographic blueprint (side, plan, front, rear), wartime photographs including
Tiger "231" and Tiger "12", and a colour interior cutaway.

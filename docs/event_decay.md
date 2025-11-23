### Algorithm Summary: Asymmetric Laplace Priority Scoring

To dynamically calculate event priority based on due dates, we utilize an **Asymmetric Laplace Distribution**. This creates a "priority spike" that peaks exactly at the due time ($T_{due}$).

Instead of a simple linear countdown, this approach models priority using two distinct **Half-Life** parameters ($\sigma$):
1.  **Urgency Horizon ($\sigma_{urgency}$):** Controls how quickly priority ramps up *before* the event.
2.  **Relevancy Decay ($\sigma_{decay}$):** Controls how quickly priority fades *after* the event is missed.

The system calculates the absolute time difference between $T_{now}$ and $T_{due}$ and applies an exponential decay function, swapping the decay rate based on whether the event is in the past or future.

#### The Formula

$$ P = I_{base} \cdot (0.5)^{\frac{|T_{now} - T_{due}|}{\sigma}} $$

Where:
*   $I_{base}$ is the intrinsic importance score (integer).
*   If $T_{now} < T_{due}$ (Early): Use $\sigma_{urgency}$.
*   If $T_{now} > T_{due}$ (Late): Use $\sigma_{decay}$.

---

### Use Case Examples

Here is how to configure the `sigma` parameters for different event archetypes:

#### 1. The Dinner Reservation (Immediate Expiry)
*   **Behavior:** Priority should be low until the day of the dinner. If you are 30 minutes late, the reservation is cancelled, and the event is irrelevant.
*   **Parameters:**
    *   `urgency_halflife`: **4 hours** (Ramps up quickly in the afternoon).
    *   `decay_halflife`: **0 hours** (Instant drop to 0.0 after due time).
*   **Result:** A sharp spike that hits 100% at 7:00 PM and vanishes at 7:01 PM.

#### 2. The Ongoing Project (Soft Decay)
*   **Behavior:** You should start working on this days in advance. If you miss the deadline, the task is still critical and must be completed, though its immediate "heat" cools off slightly as it becomes a "late backlog" item.
*   **Parameters:**
    *   `urgency_halflife`: **72 hours** (3 days). Priority builds up over the week.
    *   `decay_halflife`: **168 hours** (1 week).
*   **Result:** A wide curve. 3 days early, priority is 50%. At the deadline, it is 100%. One week late, it is still at 50% priority.

#### 3. The Critical Health Checkup (Infinite Relevancy)
*   **Behavior:** You need to be reminded to go. If you miss the appointment, the need to see the doctor does not decrease; it arguably increases or stays static. It never expires.
*   **Parameters:**
    *   `urgency_halflife`: **24 hours**.
    *   `decay_halflife`: **Infinity** (`float('inf')`).
*   **Result:** Ramps up to 100% at the appointment time. If missed, the score stays at exactly 100% forever until the user reschedules or marks it complete.

---

### Implementation

Instead of hard-coding numbers like `48` or `0.5` into your event logic, you assign semantic labels (e.g., `STRICT_DEADLINE`, `SOCIAL_EVENT`) to events. This decouples *what* an event is from the *mathematics* of how it is scored.

#### Why do this?

1.  **Eliminate "Magic Numbers":** Code containing `calculate(100, -2, 48, 0)` is confusing. A developer reading it won't know what `48` or `0` represents. Code containing `calculate(event, EventProfile.FLIGHT)` is self-explanatory.
2.  **Centralized Tuning:** If you decide that "Social Events" should actually decay slower (e.g., allow being 1 hour late instead of 30 mins), you change one number in your configuration object, and it instantly updates the behavior for thousands of events across your system.
3.  **Consistency:** It prevents user error. It ensures that every "Doctor's Appointment" in your database behaves exactly the same way, rather than relying on the user to manually input a decay rate every time.

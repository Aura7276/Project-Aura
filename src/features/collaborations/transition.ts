import {
  currentAgreement,
  deliverableDone,
  type Collaboration,
  type Access,
  type Command,
} from "./model";

/** Development preview transitions. Hosted authorization and transitions live in PostgreSQL. */
export function previewTransition(
  source: Collaboration,
  access: Access,
  command: Command,
): Collaboration {
  const c = structuredClone(source),
    at = new Date().toISOString(),
    id = crypto.randomUUID();
  const { side, manage } = access;
  const require = (condition: boolean, message: string) => {
    if (!condition) throw Error(message);
  };
  const agreement = currentAgreement(c);
  const active = () =>
    require(c.status === "Active", "An active agreement is required.");
  const manager = () =>
    require(manage, "An authorized workspace manager must perform this action.");
  switch (command.type) {
    case "accept":
      manager();
      require(c.status === "Agreement pending" &&
        agreement.templateApproved, "Agreement acceptance is unavailable.");
      require(agreement.version ===
        command.version, "Review the current agreement version.");
      if (!agreement.acceptances.some((a) => a.side === side))
        agreement.acceptances.push({ side, actor: "Preview " + side, at });
      if (agreement.acceptances.length === 2) c.status = "Active";
      break;
    case "share":
      throw Error("Content Studio sharing requires your live workspace.");
    case "message":
      c.messages.push({ id, body: command.body, side, at });
      break;
    case "submit": {
      active();
      require(side === "creator", "The Creator submits work.");
      const d = c.deliverables.find((d) => d.id === command.deliverable);
      require(!!d, "Deliverable unavailable.");
      if (!d) break;
      require(d.stage === command.stage, "Select the current approval stage.");
      require(!d.submissions.some(
        (s) => s.stage === d.stage && !s.review,
      ), "Wait for review of the current submission.");
      require(d.review !== "Approved", "This stage is already approved.");
      d.submissions.push({
        id,
        stage: d.stage,
        number: d.submissions.length + 1,
        url: command.url,
        note: command.note,
        at,
      });
      d.review = null;
      break;
    }
    case "review": {
      active();
      require(side === "brand" &&
        access.review, "An assigned Brand reviewer is required.");
      const d = c.deliverables.find((d) => d.id === command.deliverable);
      const s = d?.submissions[d.submissions.length - 1];
      require(!!d &&
        !!s &&
        s.id === command.submission &&
        s.stage === d.stage &&
        !s.review, "Review the latest unreviewed submission.");
      if (!d || !s) break;
      s.review = {
        decision: command.decision,
        note: command.note,
        scope: command.scope,
        at,
        actor: "Preview brand",
      };
      d.review = command.decision;
      const next = d.stages[d.stages.indexOf(d.stage) + 1];
      if (command.decision === "Approved" && next) {
        d.stage = next;
        d.review = null;
      }
      break;
    }
    case "fulfil": {
      active();
      require(side === "creator", "The Creator records fulfilment.");
      const d = c.deliverables.find((d) => d.id === command.deliverable);
      require(!!d &&
        d.review === "Approved" &&
        d.stage ===
          d.stages[d.stages.length - 1], "Finish the agreed reviews first.");
      require(command.date <=
        at.slice(0, 10), "Use the actual fulfilment date.");
      if (d)
        d.fulfilment = {
          url: command.url,
          date: command.date,
          note: command.note,
        };
      break;
    }
    case "change":
      active();
      manager();
      if (command.kind === "Reschedule")
        require(!!command.date &&
          c.deliverables.some(
            (d) => d.id === command.deliverable,
          ), "Choose a deliverable and proposed date.");
      c.changes.push({ ...command, id, side, at, status: "Proposed" });
      break;
    case "respond": {
      active();
      manager();
      const change = c.changes.find((x) => x.id === command.change);
      require(!!change &&
        change.status === "Proposed" &&
        change.side !== side, "The other party must respond to this proposal.");
      if (!change) break;
      require(!command.accept ||
        ["Reschedule", "Cancellation"].includes(
          change.kind,
        ), "Agreement amendments and renewals require an approved legal template.");
      change.status = command.accept ? "Accepted" : "Declined";
      if (command.accept && change.kind === "Reschedule") {
        const d = c.deliverables.find((d) => d.id === change.deliverable);
        if (d) d.due = change.date;
      }
      if (command.accept && change.kind === "Cancellation")
        c.status = "Cancelled";
      break;
    }
    case "dispute":
      manager();
      c.disputes.push({ ...command, id, side, status: "Open", evidence: [] });
      break;
    case "evidence": {
      const dispute = c.disputes.find((x) => x.id === command.dispute);
      require(!!dispute &&
        dispute.status !== "Resolved", "Choose an open concern.");
      dispute?.evidence.push({
        note: command.note,
        url: command.url,
        side,
        at,
      });
      break;
    }
    case "resolve": {
      manager();
      const dispute = c.disputes.find((x) => x.id === command.dispute);
      require(!!dispute &&
        dispute.status === "Open", "Choose an open concern.");
      if (dispute) {
        dispute.resolution = { note: command.note, side, at };
        dispute.status = "Resolution proposed";
      }
      break;
    }
    case "confirmResolution": {
      manager();
      const dispute = c.disputes.find((x) => x.id === command.dispute);
      require(!!dispute &&
        dispute.status === "Resolution proposed" &&
        dispute.resolution?.side !==
          side, "The other party must confirm the resolution.");
      if (dispute) dispute.status = "Resolved";
      break;
    }
    case "performance":
      active();
      c.performance.push({ ...command, id, at });
      break;
    case "dependency": {
      const dependency = c.dependencies.find(
        (d) => d.id === command.dependency,
      );
      require(!!dependency &&
        dependency.side ===
          side, "Only the responsible party can update this dependency.");
      if (dependency) {
        dependency.note = command.note;
        dependency.done = command.done;
      }
      break;
    }
    case "complete":
      active();
      manager();
      require(c.deliverables.length > 0 &&
        c.deliverables.every(deliverableDone) &&
        c.dependencies.every((d) => d.done) &&
        c.disputes.every(
          (d) => d.status === "Resolved",
        ), "Complete deliverables, dependencies and open concerns first.");
      if (!c.completion.includes(side)) c.completion.push(side);
      if (c.completion.length === 2) c.status = "Completed";
      break;
  }
  if (
    source.status === "Active" &&
    command.type !== "complete" &&
    command.type !== "message"
  )
    c.completion = [];
  c.revision++;
  c.activity.unshift({
    id,
    action: command.type,
    actor: "Preview " + side,
    side,
    at,
  });
  return c;
}

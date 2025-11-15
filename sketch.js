/* -------------------------------------------------------
   SUPABASE SETUP
------------------------------------------------------- */
const supabase = window.supabase.createClient(
	"https://nmkibwxtvifqrsfjxubk.supabase.co",
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ta2lid3h0dmlmcXJzZmp4dWJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNzcwMzUsImV4cCI6MjA3ODc1MzAzNX0.1JO_n9A0Vcq-QCdrEJTNU6TYfEKnn6bIxlktw44oK9I"
);

const channel = supabase.channel("circles-room");

/* -------------------------------------------------------
   GLOBAL STATE
------------------------------------------------------- */
let circles = [];
let draggingId = null;
let lastSend = 0;
const SEND_INTERVAL = 70; // throttle rate

/* -------------------------------------------------------
   P5 SETUP
------------------------------------------------------- */
async function setup() {
	createCanvas(windowWidth, windowHeight);

	// Load circles from DB
	let { data, error } = await supabase
		.from("circles")
		.select("*")
		.order("id");

	if (error) {
		console.error("DB load error:", error);
		return;
	}

	// Convert DB rows to objects
	circles = data.map(row => ({
		id: row.id,
		x: row.x,
		y: row.y,
		r: row.r,
		col: color(row.color)
	}));

	// Realtime subscription
	channel
		.on("broadcast", { event: "move" }, (msg) => {
			const { id, x, y } = msg.payload;
			let c = circles.find(c => c.id === id);
			if (c) {
				c.x = x;
				c.y = y;
			}
		})
		.subscribe();
}

/* -------------------------------------------------------
   MAIN DRAW LOOP
------------------------------------------------------- */
function draw() {
	background(240);

	for (let c of circles) {
		fill(c.col);
		noStroke();
		ellipse(c.x, c.y, c.r * 2);
	}

	dragCircle();
}

/* -------------------------------------------------------
   POINTER UTIL (Mouse + Touch)
------------------------------------------------------- */
function getPointerPosition() {
	if (touches.length > 0) {
		return { x: touches[0].x, y: touches[0].y };
	}
	return { x: mouseX, y: mouseY };
}

/* -------------------------------------------------------
   PRESS EVENTS
------------------------------------------------------- */
function mousePressed() { handlePress(); }
function touchStarted() { handlePress(); return false; }

function handlePress() {
	const { x, y } = getPointerPosition();

	for (let c of circles) {
		if (dist(x, y, c.x, c.y) < c.r) {
			draggingId = c.id;
			break;
		}
	}
}

/* -------------------------------------------------------
   RELEASE EVENTS
------------------------------------------------------- */
function mouseReleased() { handleRelease(); }
function touchEnded() { handleRelease(); return false; }

function handleRelease() {
	let c = dragCircle();
	draggingId = null;

	if (c !== null) {
		sendUpdate(c);
	}
}

/* -------------------------------------------------------
   DRAGGING LOGIC
------------------------------------------------------- */
function dragCircle() {
	if (draggingId !== null) {
		let c = circles.find(c => c.id === draggingId);
		if (c) {
			const { x, y } = getPointerPosition();
			c.x = x;
			c.y = y;
			return c;
		}
	}
	return null;
}

/* -------------------------------------------------------
   SUPABASE SYNC
------------------------------------------------------- */
async function sendUpdate(c) {
	if (millis() - lastSend < SEND_INTERVAL) return;
	lastSend = millis();

	// Realtime broadcast
	channel.send({
		type: "broadcast",
		event: "move",
		payload: { id: c.id, x: c.x, y: c.y }
	});

	// Save to DB
	const { error } = await supabase
		.from("circles")
		.update({ x: c.x, y: c.y })
		.eq("id", c.id);

	if (error) console.error("DB update error:", error);
}

const supabase = window.supabase.createClient(
	"https://nmkibwxtvifqrsfjxubk.supabase.co",
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ta2lid3h0dmlmcXJzZmp4dWJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNzcwMzUsImV4cCI6MjA3ODc1MzAzNX0.1JO_n9A0Vcq-QCdrEJTNU6TYfEKnn6bIxlktw44oK9I"
);

const channel = supabase.channel("circles-room");



let circles = [];
let draggingId = null;
let lastSend = 0;
const SEND_INTERVAL = 70; // ms throttle (≈ 14 updates/sec)

async function setup() {
	createCanvas(windowWidth, windowHeight);

	// Load circles from Supabase DB
	let { data, error } = await supabase
		.from("circles")
		.select("*")
		.order("id");

	if (error) {
		console.error("DB load error:", error);
		return;
	}

	// Convert DB rows to p5.js circle objects
	circles = data.map(row => ({
		id: row.id,
		x: row.x,
		y: row.y,
		r: row.r,
		col: color(row.color)
	}));

	// Subscribe to realtime updates
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




function draw() {
	background(240);

	for (let c of circles) {
		fill(c.col);
		noStroke();
		ellipse(c.x, c.y, c.r * 2);
	}

	dragCircle();
}




function mousePressed() {
	// Check if clicking on any circle
	for (let c of circles) {
		if (dist(mouseX, mouseY, c.x, c.y) < c.r) {
			draggingId = c.id;
			break;
		}
	}
}
function mouseReleased() {
	let c = dragCircle();
	draggingId = null;

	if (c !== null) {
		sendUpdate(c);
	}
}
function dragCircle() {
	if (draggingId !== null) {
		let c = circles.find(c => c.id === draggingId);
		if (c) {
			c.x = mouseX;
			c.y = mouseY;
			return c;
		}
	}
	return null;
}
async function sendUpdate(c) {
	// Throttle realtime messages
	if (millis() - lastSend < SEND_INTERVAL) return;
	lastSend = millis();

	// Realtime broadcast
	channel.send({
		type: "broadcast",
		event: "move",
		payload: { id: c.id, x: c.x, y: c.y }
	});

	// Save to database so new players get the latest positions
	const { error } = await supabase
		.from("circles")
		.update({ x: c.x, y: c.y })
		.eq("id", c.id);

	if (error) console.error("DB update error:", error);
}

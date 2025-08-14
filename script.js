document.getElementById("addEventBtn").addEventListener("click", function() {
    const eventList = document.getElementById("event-list");
    const newEvent = document.createElement("li");
    newEvent.textContent = "8月25日：来店感謝イベント - ドリンクサービス！";
    eventList.appendChild(newEvent);
});



document.addEventListener("DOMContentLoaded", function() {
    emailjs.init("lz1RP-zscAZDnEhq1"); // Initialize with your EmailJS Public Key

    document.getElementById("contact-form").addEventListener("submit", function(event) {
        event.preventDefault();

        emailjs.sendForm("service_69w7fcj", "template_qm9dhuy", this)
            .then(function(response) {
                alert("Message sent successfully!");
                document.getElementById("contact-form").reset(); // Clear form after submission
            }, function(error) {
                alert("Failed to send message. Please try again later.");
            });
    });
});

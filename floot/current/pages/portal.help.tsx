import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import styles from "./portal.help.module.css";

export default function PortalHelpPage() {
  return (
    <div>
      <Helmet>
        <title>Help — Boolean Global</title>
      </Helmet>
      <h1 className={styles.title}>Help</h1>
      <p className={styles.subtitle}>Questions about your account? Use our contact form while our support channels are being finalized.</p>

      <div className={styles.card}>
        <p className={styles.contactNote}>Our support contact is being finalized. Please do not send personal documents or sensitive information by email. Agreement signing is unavailable while launch preparation is in progress.</p>
      </div>


      <div className={styles.faq}>
        <h2 className={styles.faqTitle}>Frequently asked</h2>
        <div className={styles.faqItem}>
          <h3>How do I cancel my agreement?</h3>
          <p>
            Agreement signing is currently unavailable. For an existing agreement or account question, <Link to="/contact">submit a contact request</Link>. Do not include SSNs or documents. A verified cancellation process must be in place before service enrollment opens.
          </p>
        </div>
        <div className={styles.faqItem}>
          <h3>When will I see results?</h3>
          <p>
            Timelines vary by case. Your advisor will keep your Activity page updated as work on your file
            progresses.
          </p>
        </div>
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";
import type { ProjectCard } from "../lib/content-schema";

export default function ProjectExplorer({
  projects,
}: {
  projects: ProjectCard[];
}) {
  const [active, setActive] = useState("Все");
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const filters = [
    "Все",
    ...Array.from(
      new Set(
        projects
          .filter((p) => p.status === "published")
          .flatMap((p) => p.disciplines),
      ),
    ),
  ];
  const visible = projects.filter(
    (p) =>
      active === "Все" ||
      p.disciplines.includes(active as ProjectCard["disciplines"][number]),
  );
  return (
    <div>
      {filters.length > 1 && (
        <div
          className="filters"
          role="group"
          aria-label="Направления работ"
          hidden={!ready}
        >
          {filters.map((filter) => (
            <button
              type="button"
              key={filter}
              aria-label={`${filter}, работ: ${filter === "Все" ? projects.length : projects.filter((p) => p.disciplines.includes(filter as ProjectCard["disciplines"][number])).length}`}
              aria-pressed={active === filter}
              onClick={() => setActive(filter)}
            >
              {filter}
              <span>
                {filter === "Все"
                  ? projects.length
                  : projects.filter((p) =>
                      p.disciplines.includes(
                        filter as ProjectCard["disciplines"][number],
                      ),
                    ).length}
              </span>
            </button>
          ))}
        </div>
      )}
      {ready && (
        <p className="result-count" role="status">
          Показано работ: {visible.length}
        </p>
      )}
      <div className="project-grid">
        {visible.map((project) => (
          <article className="project-card" key={project.slug} data-reveal>
            {project.cover && (
              <div className="project-cover">
                <img
                  src={project.cover.src}
                  alt={project.cover.alt}
                  width={project.cover.width}
                  height={project.cover.height}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            )}
            <div className="project-card-body">
              <div className="project-meta">
                <span>{project.year}</span>
                <span>
                  {project.status === "coming-soon"
                    ? "Скоро"
                    : project.kind === "experiment"
                      ? "Эксперимент"
                      : "Кейс"}
                </span>
              </div>
              <h3>
                {project.status === "published" ? (
                  <a href={`/projects/${project.slug}/`}>
                    {project.title} <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  project.title
                )}
              </h3>
              <p>{project.summary}</p>
              <div className="tags">
                {project.disciplines.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              {project.status === "published" && (
                <div className="card-actions">
                  {project.demo ? (
                    <a href={`/demos/${project.demo}/`}>Демо ↗</a>
                  ) : (
                    project.links.live && (
                      <a
                        href={project.links.live}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Открыть приложение ↗
                      </a>
                    )
                  )}
                  {project.links.source && (
                    <a
                      href={project.links.source}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Код ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      {visible.length === 0 && (
        <p className="empty-state">
          В этом направлении пока нет опубликованных работ.
        </p>
      )}
    </div>
  );
}
